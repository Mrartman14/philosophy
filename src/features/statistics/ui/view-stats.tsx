// src/features/statistics/ui/view-stats.tsx
import { EmptyState, RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import { entityLabels } from "../entity-labels";
import type { ViewStatItem, ViewStatsData } from "../types";

const BASE_PATH: Record<string, string> = {
  lecture: "/lectures",
  document: "/documents",
  trail: "/trails",
  canvas: "/canvases",
  form: "/forms",
};

/** Путь на цель просмотра или null, если тип/ид неизвестны. */
function targetHref(item: ViewStatItem): string | null {
  const base = BASE_PATH[item.target_type ?? ""];
  if (!base || !item.target_id) return null;
  return `${base}/${item.target_id}`;
}

export async function ViewStats({
  stats,
  trackingEnabled,
}: {
  stats: ViewStatsData;
  trackingEnabled: boolean;
}) {
  const t = await getT("statistics");
  const labels = entityLabels(t);

  if (!trackingEnabled) {
    return (
      <EmptyState
        title={t("trackingDisabledTitle")}
        description={t("trackingDisabledDescription")}
        action={<RouterLink href="/me/settings">{t("goToSettings")}</RouterLink>}
      />
    );
  }

  if ((stats.total ?? 0) === 0) {
    return (
      <EmptyState
        title={t("noViewsTitle")}
        description={t("noViewsDescription")}
      />
    );
  }

  const byType = stats.count_by_type ?? {};
  const top = stats.top ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {t("totalViews")} <strong>{stats.total}</strong>
      </p>

      {Object.keys(byType).length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-(--color-fg-muted)">
          {Object.entries(byType).map(([type, count]) => (
            <li key={type}>
              {labels[type] ?? type}: {count}
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-col gap-2">
        {top.map((item) => {
          const href = item.available ? targetHref(item) : null;
          return (
            <li
              key={`${item.target_type}:${item.target_id}`}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {href ? (
                  <RouterLink href={href}>{item.title ?? t("untitled")}</RouterLink>
                ) : (
                  <span className="text-(--color-fg-muted)">{t("unavailable")}</span>
                )}
              </span>
              <span className="shrink-0 text-(--color-fg-muted)">
                {t("viewCount", { count: item.count ?? 0 })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
