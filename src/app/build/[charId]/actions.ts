"use server";

import { generateStructuredText, GeminiError } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BuildRecommendation = {
  recommended_set_id: string | null;
  recommended_set_name_ru: string;
  recommended_set_reasoning: string;
  recommended_arc_id: string | null;
  recommended_arc_name_ru: string | null;
  recommended_arc_reasoning: string | null;
  main_stat_priorities: string[];
  sub_stat_priorities: string[];
  free_module_strategy: string;
  overall_summary: string;
};

const RECOMMEND_SCHEMA = {
  type: "object",
  properties: {
    recommended_set_id: { type: "string", nullable: true },
    recommended_set_name_ru: { type: "string" },
    recommended_set_reasoning: { type: "string" },
    recommended_arc_id: { type: "string", nullable: true },
    recommended_arc_name_ru: { type: "string", nullable: true },
    recommended_arc_reasoning: { type: "string", nullable: true },
    main_stat_priorities: { type: "array", items: { type: "string" } },
    sub_stat_priorities: { type: "array", items: { type: "string" } },
    free_module_strategy: { type: "string" },
    overall_summary: { type: "string" },
  },
  required: [
    "recommended_set_id",
    "recommended_set_name_ru",
    "recommended_set_reasoning",
    "recommended_arc_id",
    "recommended_arc_name_ru",
    "recommended_arc_reasoning",
    "main_stat_priorities",
    "sub_stat_priorities",
    "free_module_strategy",
    "overall_summary",
  ],
};

const SYSTEM_PROMPT = `Ты эксперт по игре Neverness To Everness (NTE). Тебе дают данные о персонаже игрока и список доступных в его инвентаре сетов экипировки и Дуг (оружия).

Твоя задача — порекомендовать оптимальный билд:
1. Выбрать ОДИН сет из списка (укажи его id и имя)
2. Выбрать ОДНУ Дугу из списка (если список пуст — оставь null)
3. Указать приоритеты главных и доп.статов для модулей
4. Объяснить логику простым языком

ПРАВИЛА:
- Отвечай СТРОГО на русском, используя термины из приложенного контекста.
- Английские слова — только в скобках при первом упоминании, если термина нет в данных.
- Имена сетов и Дуг копируй точно как в списке (включая регистр и пунктуацию).
- id сета и Дуги бери из списка, не выдумывай.
- Если в списке нет подходящих кандидатов — честно скажи в reasoning, но всё равно выбери лучший вариант из имеющихся.

ЛОГИКА БИЛДА:
- Сет с 2pc-бонусом «урон {стихия} +N%» подходит персонажу с такой же стихией.
- Сетовые 4pc-бонусы вроде «крит. урон», «игнор защиты» — для атакующих (Урон).
- 4pc «лечение», «уменьшение урона» — для поддержки/выживания.
- Главные статы модулей под Урон-роль: Бонус к урону {стихия персонажа} %, Атака %, Крит. урон.
- Главные статы под Усиление: ОЗ %, Атака % (для бафф-скейла), Эссентия (если применимо).
- Главные статы под Выживание: ОЗ %, Защита %.

Возврати JSON по схеме.`;

export async function recommendBuild(
  characterId: string,
): Promise<{ ok: true; recommendation: BuildRecommendation } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. Загрузить персонажа
  const { data: character, error: charErr } = await supabase
    .from("characters")
    .select("id, name_ru, role, anima_type, arc_type, rank, notes")
    .eq("id", characterId)
    .maybeSingle();

  if (charErr || !character) {
    return { ok: false, error: "Персонаж не найден" };
  }

  // 2. Все сеты с бонусами
  const { data: sets } = await supabase
    .from("sets")
    .select("id, name_ru, damage_type_ru, bonus_2pc_ru, bonus_4pc_ru")
    .order("name_ru");

  // 3. Дуги с подходящим типом
  const arcs = character.arc_type
    ? (
        await supabase
          .from("arcs")
          .select("id, name_ru, arc_type, rarity, passive_text_ru")
          .eq("arc_type", character.arc_type)
      ).data ?? []
    : [];

  // 4. Глоссарий — для подгона терминов
  const { data: glossary } = await supabase
    .from("glossary")
    .select("term_ru, term_en, category, confirmed")
    .eq("confirmed", true);

  const userPrompt = buildUserPrompt(character, sets ?? [], arcs, glossary ?? []);

  try {
    const recommendation = await generateStructuredText<BuildRecommendation>({
      model: "gemini-2.5-pro",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      responseSchema: RECOMMEND_SCHEMA,
      temperature: 0.4,
    });
    return { ok: true, recommendation };
  } catch (e) {
    if (e instanceof GeminiError) {
      console.error("[recommendBuild] Gemini error", e.status, e.body);
      return { ok: false, error: `Gemini API ошибка ${e.status}` };
    }
    console.error("[recommendBuild] unknown error", e);
    return { ok: false, error: "Не удалось получить рекомендацию" };
  }
}

function buildUserPrompt(
  character: {
    id: string;
    name_ru: string;
    role: string | null;
    anima_type: string | null;
    arc_type: string | null;
    rank: string | null;
  },
  sets: Array<{
    id: string;
    name_ru: string;
    damage_type_ru: string | null;
    bonus_2pc_ru: string | null;
    bonus_4pc_ru: string | null;
  }>,
  arcs: Array<{
    id: string;
    name_ru: string;
    arc_type: string;
    rarity: string | null;
    passive_text_ru: string | null;
  }>,
  glossary: Array<{ term_ru: string; term_en: string | null; category: string }>,
): string {
  const parts: string[] = [];

  parts.push("ПЕРСОНАЖ:");
  parts.push(`- Имя: ${character.name_ru}`);
  parts.push(`- Роль: ${character.role ?? "не указана"}`);
  parts.push(`- Стихия: ${character.anima_type ?? "не указана"}`);
  parts.push(`- Тип Дуги: ${character.arc_type ?? "не указан"}`);
  parts.push(`- Ранг: ${character.rank ?? "не указан"}`);

  parts.push("\nДОСТУПНЫЕ СЕТЫ (выбери один):");
  for (const s of sets) {
    parts.push(
      `- id=${s.id}; имя=«${s.name_ru}»; тип урона=${s.damage_type_ru ?? "—"}; 2pc=«${s.bonus_2pc_ru ?? "—"}»; 4pc=«${s.bonus_4pc_ru ?? "—"}»`,
    );
  }

  if (arcs.length > 0) {
    parts.push("\nДОСТУПНЫЕ ДУГИ (выбери одну):");
    for (const a of arcs) {
      parts.push(
        `- id=${a.id}; имя=«${a.name_ru}»; тип=${a.arc_type}; ранг=${a.rarity ?? "—"}; пассивка=«${a.passive_text_ru ?? "—"}»`,
      );
    }
  } else {
    parts.push(
      "\nДОСТУПНЫЕ ДУГИ: (список пуст, recommended_arc_id и recommended_arc_name_ru должны быть null)",
    );
  }

  if (glossary.length > 0) {
    parts.push("\nГЛОССАРИЙ (используй ТОЛЬКО эти русские термины):");
    const byCategory = new Map<string, string[]>();
    for (const g of glossary) {
      if (!byCategory.has(g.category)) byCategory.set(g.category, []);
      byCategory.get(g.category)!.push(g.term_ru);
    }
    for (const [cat, terms] of byCategory.entries()) {
      parts.push(`- ${cat}: ${terms.join(", ")}`);
    }
  }

  parts.push(
    "\nЗадача: выбери оптимальный сет и Дугу, объясни выбор в reasoning, дай приоритеты статов модулей. Ответ строго в JSON по схеме.",
  );

  return parts.join("\n");
}
