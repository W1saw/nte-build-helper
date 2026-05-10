import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">NTE Build Helper</h1>
      <p className="mt-2 text-neutral-600">Привет, {user.email}.</p>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          href="/admin/upload"
          className="block rounded-md border border-neutral-200 bg-white p-4 hover:border-neutral-400"
        >
          <div className="text-sm font-medium text-neutral-700">
            📷 Загрузка скринов
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            Карточки сетов и персонажей → Gemini Vision → каталог
          </div>
        </a>
        <div className="block rounded-md border border-dashed border-neutral-200 p-4 text-neutral-400">
          <div className="text-sm font-medium">🔧 Конструктор сборки</div>
          <div className="mt-1 text-xs">скоро (Этап 1)</div>
        </div>
      </section>

      <form action="/auth/signout" method="post" className="mt-12">
        <button
          type="submit"
          className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline"
        >
          Выйти
        </button>
      </form>
    </main>
  );
}
