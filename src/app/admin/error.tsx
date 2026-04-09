"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold">Ошибка в админ-панели</h1>
      <p className="text-sm text-(--color-description)">
        Произошла ошибка при загрузке страницы.
      </p>
      <button
        onClick={reset}
        className="px-3 py-2 border border-(--color-border) rounded text-sm hover:bg-(--color-text-pane)"
      >
        Попробовать снова
      </button>
    </div>
  );
}
