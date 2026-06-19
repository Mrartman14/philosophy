// src/features/statistics/ui/view-stats.tsx
import { EmptyState, RouterLink } from "@/components/ui";

import type { ViewStatItem, ViewStatsData } from "../types";

const LABELS: Record<string, string> = {
  lecture: "Лекции",
  document: "Документы",
  trail: "Маршруты",
  canvas: "Канвасы",
  form: "Формы",
};

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

export function ViewStats({
  stats,
  trackingEnabled,
}: {
  stats: ViewStatsData;
  trackingEnabled: boolean;
}) {
  if (!trackingEnabled) {
    return (
      <EmptyState
        title="Трекинг просмотров выключен"
        description="Включите его в настройках, чтобы видеть статистику просмотров."
        action={<RouterLink href="/me/settings">Перейти в настройки</RouterLink>}
      />
    );
  }

  if ((stats.total ?? 0) === 0) {
    return (
      <EmptyState
        title="Вы пока ничего не просматривали"
        description="Статистика появится после первых просмотров материалов."
      />
    );
  }

  const byType = stats.count_by_type ?? {};
  const top = stats.top ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Всего просмотров: <strong>{stats.total}</strong>
      </p>

      {Object.keys(byType).length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-(--color-fg-muted)">
          {Object.entries(byType).map(([type, count]) => (
            <li key={type}>
              {LABELS[type] ?? type}: {count}
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
                  <RouterLink href={href}>{item.title ?? "Без названия"}</RouterLink>
                ) : (
                  <span className="text-(--color-fg-muted)">Недоступно</span>
                )}
              </span>
              <span className="shrink-0 text-(--color-fg-muted)">
                {item.count} просм.
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
