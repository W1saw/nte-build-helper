import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BuildBuilder, type SetRow, type SetRequiredShape, type Shape } from "./BuildBuilder";

export default async function BuildPage({
  params,
}: {
  params: Promise<{ charId: string }>;
}) {
  const { charId } = await params;
  const supabase = await createSupabaseServerClient();

  const [charRes, setsRes, requiredRes, shapesRes] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name_ru, role, anima_type, arc_type, rank, notes")
      .eq("id", charId)
      .maybeSingle(),
    supabase
      .from("sets")
      .select("id, name_ru, damage_type_ru, bonus_2pc_ru, bonus_4pc_ru")
      .order("name_ru"),
    supabase
      .from("set_required_shapes")
      .select("set_id, position, shape_id"),
    supabase
      .from("shapes")
      .select("id, type_roman, cell_count, name_ru, pattern")
      .order("type_roman")
      .order("id"),
  ]);

  if (!charRes.data) notFound();

  const character = charRes.data as {
    id: string;
    name_ru: string;
    role: string | null;
    anima_type: string | null;
    arc_type: string | null;
    rank: string | null;
    notes: string | null;
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/"
        className="text-sm text-neutral-600 hover:underline"
      >
        ← На главную
      </Link>

      <CharacterHeader character={character} />

      <BuildBuilder
        character={character}
        sets={(setsRes.data ?? []) as SetRow[]}
        requiredShapes={(requiredRes.data ?? []) as SetRequiredShape[]}
        shapes={(shapesRes.data ?? []) as Shape[]}
      />
    </main>
  );
}

function CharacterHeader({
  character,
}: {
  character: {
    name_ru: string;
    role: string | null;
    anima_type: string | null;
    arc_type: string | null;
    rank: string | null;
    notes: string | null;
  };
}) {
  return (
    <section className="mt-4 mb-8 rounded-md border border-neutral-200 bg-white p-5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{character.name_ru}</h1>
        {character.rank && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              character.rank === "S"
                ? "bg-amber-100 text-amber-800"
                : "bg-neutral-100 text-neutral-700"
            }`}
          >
            Ранг {character.rank}
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Стихия" value={character.anima_type} />
        <Stat label="Роль" value={character.role} />
        <Stat label="Тип Дуги (Arc)" value={character.arc_type} />
        <Stat label="Заметки" value={character.notes} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-neutral-900">{value ?? "—"}</dd>
    </div>
  );
}
