"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Что-то пошло не так</h1>
      <p className="text-(--color-description)">
        Произошла ошибка при загрузке страницы.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded border border-(--color-border) hover:bg-(--color-text-pane)"
      >
        Попробовать снова
      </button>
    </div>
  );
}
