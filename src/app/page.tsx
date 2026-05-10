import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Character = {
  id: string;
  name_ru: string;
  role: string | null;
  anima_type: string | null;
  arc_type: string | null;
  rank: string | null;
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name_ru, role, anima_type, arc_type, rank")
    .order("rank")
    .order("name_ru");

  const list = (characters ?? []) as Character[];
  const sChars = list.filter((c) => c.rank === "S");
  const aChars = list.filter((c) => c.rank === "A");
  const otherChars = list.filter((c) => c.rank !== "S" && c.rank !== "A");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">NTE Build Helper</h1>
          <p className="mt-1 text-sm text-neutral-600">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/upload"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
          >
            📷 Загрузка скринов
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline"
            >
              Выйти
            </button>
          </form>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Ранг S <span className="text-sm font-normal text-neutral-500">({sChars.length})</span>
        </h2>
        <CharacterGrid characters={sChars} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Ранг A <span className="text-sm font-normal text-neutral-500">({aChars.length})</span>
        </h2>
        <CharacterGrid characters={aChars} />
      </section>

      {otherChars.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">
            Без ранга <span className="text-sm font-normal text-neutral-500">({otherChars.length})</span>
          </h2>
          <CharacterGrid characters={otherChars} />
        </section>
      )}

      {list.length === 0 && (
        <div className="rounded-md border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
          В БД нет персонажей. Залей через SQL или /admin/upload.
        </div>
      )}
    </main>
  );
}

function CharacterGrid({ characters }: { characters: Character[] }) {
  if (characters.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {characters.map((c) => (
        <Link
          key={c.id}
          href={`/build/${c.id}`}
          className="block rounded-md border border-neutral-200 bg-white p-3 transition hover:border-neutral-400 hover:shadow-sm"
        >
          <div className="text-sm font-medium text-neutral-900">{c.name_ru}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
            {c.anima_type && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                {c.anima_type}
              </span>
            )}
            {c.role && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">{c.role}</span>
            )}
            {c.arc_type && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                {c.arc_type}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
