import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    reason === "no_code"
      ? "Ссылка некорректная — нет кода авторизации."
      : reason === "exchange_failed"
        ? "Не удалось войти. Попробуйте запросить новую ссылку."
        : "Ошибка авторизации.";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold">Ошибка входа</h1>
        <p className="mt-2 text-sm text-neutral-600">{message}</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Вернуться к входу
        </Link>
      </div>
    </main>
  );
}
