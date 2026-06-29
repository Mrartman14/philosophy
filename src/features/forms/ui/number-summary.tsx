// src/features/forms/ui/number-summary.tsx
import { getServerFmt, getT } from "@/i18n";

import type { NumberStats } from "../types";

export async function NumberSummary({ stats }: { stats: NumberStats }) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  const n = (v: number | undefined) => (typeof v === "number" ? fmt.number(v) : "—");
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <div><dt className="inline text-(--color-fg-muted)">{t("results.min")}: </dt><dd className="inline tabular-nums">{n(stats.min)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.max")}: </dt><dd className="inline tabular-nums">{n(stats.max)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.avg")}: </dt><dd className="inline tabular-nums">{n(stats.avg)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.sum")}: </dt><dd className="inline tabular-nums">{n(stats.sum)}</dd></div>
    </dl>
  );
}
