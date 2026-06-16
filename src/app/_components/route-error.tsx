"use client";

import { Button } from "@/components/ui";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Что-то пошло не так</h1>
      <p className="text-(--color-description)">
        Произошла ошибка при загрузке страницы.
      </p>
      <Button variant="secondary" onClick={reset}>
        Попробовать снова
      </Button>
    </div>
  );
}
