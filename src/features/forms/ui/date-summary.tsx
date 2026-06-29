// src/features/forms/ui/date-summary.tsx
import { getServerFmt, getT } from "@/i18n";

import type { DateStats } from "../types";

export async function DateSummary({ stats }: { stats: DateStats }) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  // Чистая дата YYYY-MM-DD → форматируем как UTC-дату (не подмешивать таймзону пользователя).
  const d = (v: string | undefined) =>
    v ? fmt.dateTime(`${v}T00:00:00Z`, { dateStyle: "medium", timeZone: "UTC" }) : "—";
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <div><dt className="inline text-(--color-fg-muted)">{t("results.min")}: </dt><dd className="inline">{d(stats.min)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.max")}: </dt><dd className="inline">{d(stats.max)}</dd></div>
    </dl>
  );
}
