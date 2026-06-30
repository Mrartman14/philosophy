// src/features/forms/ui/date-summary.tsx
import { getServerFmt, getT } from "@/i18n";

import type { DateStats } from "../types";

import { StatPair } from "./stat-pair";

export async function DateSummary({ stats }: { stats: DateStats }) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  // Чистая дата YYYY-MM-DD → форматируем как UTC-дату (не подмешивать таймзону пользователя).
  const d = (v: string | undefined) => {
    if (!v) return "—";
    const dt = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return "—";
    return fmt.dateTime(dt, { dateStyle: "medium", timeZone: "UTC" });
  };
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <StatPair label={t("results.min")} value={d(stats.min)} />
      <StatPair label={t("results.max")} value={d(stats.max)} />
    </dl>
  );
}
