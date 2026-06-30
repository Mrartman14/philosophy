// src/features/forms/ui/number-summary.tsx
import { getServerFmt, getT } from "@/i18n";

import type { NumberStats } from "../types";

import { StatPair } from "./stat-pair";

export async function NumberSummary({ stats }: { stats: NumberStats }) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  const n = (v: number | undefined) => (typeof v === "number" ? fmt.number(v) : "—");
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <StatPair label={t("results.min")} value={n(stats.min)} />
      <StatPair label={t("results.max")} value={n(stats.max)} />
      <StatPair label={t("results.avg")} value={n(stats.avg)} />
      <StatPair label={t("results.sum")} value={n(stats.sum)} />
    </dl>
  );
}
