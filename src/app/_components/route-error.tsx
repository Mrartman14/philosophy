"use client";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";
import { useReportBoundaryError } from "@/services/observability/use-report-boundary-error";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportBoundaryError(error);
  const t = useT("pages");
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">{t("errorTitle")}</h1>
      <p className="text-(--color-fg-muted)">
        {t("errorBody")}
      </p>
      <Button variant="secondary" onClick={reset}>
        {t("errorRetry")}
      </Button>
    </div>
  );
}
