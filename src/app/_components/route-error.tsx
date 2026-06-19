"use client";

import { Button } from "@/components/ui";
import { useReportBoundaryError } from "@/services/observability/use-report-boundary-error";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportBoundaryError(error);
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Что-то пошло не так</h1>
      <p className="text-(--color-fg-muted)">
        Произошла ошибка при загрузке страницы.
      </p>
      <Button variant="secondary" onClick={reset}>
        Попробовать снова
      </Button>
    </div>
  );
}
