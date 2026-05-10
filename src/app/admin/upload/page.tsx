import Link from "next/link";
import { listShapes } from "./actions";
import { UploadUI } from "./UploadUI";

export default async function UploadPage() {
  const shapes = await listShapes();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-600 hover:underline">
            ← На главную
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Загрузка скринов из NTE</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Каждый скрин — определённого типа. Gemini Vision вытаскивает структурированные данные → ты ревьюишь → сохраняем в БД.
          </p>
        </div>
      </div>

      <UploadUI shapes={shapes} />
    </main>
  );
}
