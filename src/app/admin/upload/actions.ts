"use server";

import { revalidatePath } from "next/cache";
import { generateStructuredFromImage, GeminiError } from "@/lib/gemini";
import {
  CHARACTER_PROMPT,
  CHARACTER_SCHEMA,
  SET_CARD_PROMPT,
  SET_CARD_SCHEMA,
  type ParsedCharacter,
  type ParsedSetCard,
} from "@/lib/vision-prompts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ScreenType = "set_card" | "character";

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function parseScreenshot(
  formData: FormData,
): Promise<ParseResult<{ type: ScreenType; data: ParsedSetCard | ParsedCharacter }>> {
  const file = formData.get("image") as File | null;
  const type = formData.get("type") as ScreenType | null;

  if (!file || !type) {
    return { ok: false, error: "Не передан файл или тип скрина." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Файл больше 10 МБ — слишком большой для обработки." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = file.type || "image/png";

  try {
    if (type === "set_card") {
      const data = await generateStructuredFromImage<ParsedSetCard>({
        model: "gemini-2.5-flash",
        systemPrompt: SET_CARD_PROMPT,
        userPrompt: "Распознай карточку сета согласно инструкции.",
        imageBase64: base64,
        imageMimeType: mimeType,
        responseSchema: SET_CARD_SCHEMA,
      });
      return { ok: true, data: { type, data } };
    }

    if (type === "character") {
      const data = await generateStructuredFromImage<ParsedCharacter>({
        model: "gemini-2.5-flash",
        systemPrompt: CHARACTER_PROMPT,
        userPrompt: "Распознай карточку персонажа согласно инструкции.",
        imageBase64: base64,
        imageMimeType: mimeType,
        responseSchema: CHARACTER_SCHEMA,
      });
      return { ok: true, data: { type, data } };
    }

    return { ok: false, error: `Неизвестный тип скрина: ${type}` };
  } catch (e) {
    if (e instanceof GeminiError) {
      console.error("[parseScreenshot] Gemini error", e.status, e.body);
      return { ok: false, error: `Gemini API ошибка ${e.status}. См. логи Vercel.` };
    }
    console.error("[parseScreenshot] unknown error", e);
    return { ok: false, error: "Не удалось распознать скрин." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Сохранение распознанной карточки сета
// ═══════════════════════════════════════════════════════════════════════════

export type SaveSetCardInput = {
  set_name_ru: string;
  damage_type_ru: string | null;
  bonus_2pc_ru: string;
  bonus_4pc_ru: string;
  required_shape_ids: [string, string, string, string]; // 4 shape_id из public.shapes
  observed_main_stat: { name: string; value: string };
  observed_sub_stats: Array<{ name: string; value: string }>;
};

export async function saveSetCard(
  input: SaveSetCardInput,
): Promise<{ ok: true; setId: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. upsert сета по name_ru
  const { data: existingSet } = await supabase
    .from("sets")
    .select("id")
    .eq("name_ru", input.set_name_ru)
    .maybeSingle();

  let setId: string;
  if (existingSet) {
    setId = existingSet.id;
    const { error: updateErr } = await supabase
      .from("sets")
      .update({
        damage_type_ru: input.damage_type_ru,
        bonus_2pc_ru: input.bonus_2pc_ru,
        bonus_4pc_ru: input.bonus_4pc_ru,
      })
      .eq("id", setId);
    if (updateErr) {
      console.error("[saveSetCard] update set failed", updateErr);
      return { ok: false, error: `Не удалось обновить сет: ${updateErr.message}` };
    }
  } else {
    const { data: created, error: insertErr } = await supabase
      .from("sets")
      .insert({
        name_ru: input.set_name_ru,
        damage_type_ru: input.damage_type_ru,
        bonus_2pc_ru: input.bonus_2pc_ru,
        bonus_4pc_ru: input.bonus_4pc_ru,
      })
      .select("id")
      .single();
    if (insertErr || !created) {
      console.error("[saveSetCard] insert set failed", insertErr);
      return {
        ok: false,
        error: `Не удалось создать сет: ${insertErr?.message ?? "unknown"}`,
      };
    }
    setId = created.id;
  }

  // 2. перезаписать 4 формы сета (set_required_shapes)
  const { error: deleteErr } = await supabase
    .from("set_required_shapes")
    .delete()
    .eq("set_id", setId);
  if (deleteErr) {
    console.error("[saveSetCard] delete required shapes failed", deleteErr);
    return { ok: false, error: `Не удалось очистить формы сета: ${deleteErr.message}` };
  }

  const rows = input.required_shape_ids.map((shape_id, idx) => ({
    set_id: setId,
    position: idx + 1,
    shape_id,
  }));
  const { error: insertShapesErr } = await supabase
    .from("set_required_shapes")
    .insert(rows);
  if (insertShapesErr) {
    console.error("[saveSetCard] insert required shapes failed", insertShapesErr);
    return {
      ok: false,
      error: `Не удалось сохранить формы сета: ${insertShapesErr.message}`,
    };
  }

  // 3. пополнить глоссарий
  const glossaryEntries = [
    { term_ru: input.set_name_ru, category: "set" as const },
    input.damage_type_ru
      ? { term_ru: `урон ${input.damage_type_ru}`, category: "mechanic" as const }
      : null,
    { term_ru: input.observed_main_stat.name, category: "stat" as const },
    ...input.observed_sub_stats.map((s) => ({
      term_ru: s.name,
      category: "stat" as const,
    })),
  ].filter((e): e is { term_ru: string; category: "set" | "mechanic" | "stat" } => !!e);

  for (const entry of glossaryEntries) {
    if (!entry.term_ru.trim()) continue;
    await supabase
      .from("glossary")
      .upsert(
        { term_ru: entry.term_ru, category: entry.category, confirmed: true },
        { onConflict: "term_ru,category" },
      );
  }

  revalidatePath("/admin/upload");
  return { ok: true, setId };
}

// ═══════════════════════════════════════════════════════════════════════════
// Сохранение персонажа
// ═══════════════════════════════════════════════════════════════════════════

export type SaveCharacterInput = {
  name_ru: string;
  role: string | null;
  anima_type: string | null;
  notes: string | null;
};

export async function saveCharacter(
  input: SaveCharacterInput,
): Promise<{ ok: true; characterId: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("characters")
    .select("id")
    .eq("name_ru", input.name_ru)
    .maybeSingle();

  let characterId: string;
  if (existing) {
    characterId = existing.id;
    const { error } = await supabase
      .from("characters")
      .update({
        role: input.role,
        anima_type: input.anima_type,
        notes: input.notes,
      })
      .eq("id", characterId);
    if (error) {
      console.error("[saveCharacter] update failed", error);
      return { ok: false, error: error.message };
    }
  } else {
    const { data: created, error } = await supabase
      .from("characters")
      .insert({
        name_ru: input.name_ru,
        role: input.role,
        anima_type: input.anima_type,
        notes: input.notes,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[saveCharacter] insert failed", error);
      return { ok: false, error: error?.message ?? "unknown" };
    }
    characterId = created.id;
  }

  // Глоссарий
  await supabase
    .from("glossary")
    .upsert(
      { term_ru: input.name_ru, category: "character", confirmed: true },
      { onConflict: "term_ru,category" },
    );

  revalidatePath("/admin/upload");
  return { ok: true, characterId };
}

// ═══════════════════════════════════════════════════════════════════════════
// Загрузка списка форм для UI (для дропдаунов)
// ═══════════════════════════════════════════════════════════════════════════

export async function listShapes(): Promise<
  Array<{ id: string; type_roman: string; cell_count: number; name_ru: string | null }>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shapes")
    .select("id, type_roman, cell_count, name_ru")
    .order("cell_count")
    .order("id");
  if (error) {
    console.error("[listShapes] failed", error);
    return [];
  }
  return data ?? [];
}
