"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold">Ошибка загрузки комментариев</h1>
      <button
        onClick={reset}
        className="px-3 py-2 border border-(--color-border) rounded text-sm hover:bg-(--color-text-pane)"
      >
        Попробовать снова
      </button>
    </div>
  );
}
