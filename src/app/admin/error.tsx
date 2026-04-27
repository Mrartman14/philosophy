// src/app/admin/error.tsx
"use client";
export default function AdminError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-(--color-border) px-3 py-1 text-sm"
      >
        Попробовать снова
      </button>
    </div>
  );
}
