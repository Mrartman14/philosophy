"use client";

import Link from "next/link";

export default function LectureError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Не удалось загрузить лекцию</h1>
      <p className="text-(--color-description)">
        Проверьте подключение к интернету или попробуйте позже.
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-4 py-2 rounded border border-(--color-border) hover:bg-(--color-text-pane)"
        >
          Попробовать снова
        </button>
        <Link href="/" className="px-4 py-2 rounded border border-(--color-border) hover:bg-(--color-text-pane)">
          На главную
        </Link>
      </div>
    </div>
  );
}
