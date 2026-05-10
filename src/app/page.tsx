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
      <p className="mt-2 text-neutral-600">
        Привет, {user.email}. Это пустая заглушка — Этап 0 (каркас) готов.
      </p>
      <p className="mt-4 text-sm text-neutral-500">
        Следующие этапы: UI конструктора → Vision-пайплайн скринов → RAG.
      </p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Выйти
        </button>
      </form>
    </main>
  );
}
