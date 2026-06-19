// src/components/revision-history/revision-history.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { RevisionHistoryProps } from "./types";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFormat.format(d);
}

/**
 * Generic-компонент истории ревизий. НЕ знает о доменах: список ревизий и
 * контент выбранной ревизии приходят снаружи (см. types.ts). Серверный
 * компонент — никакого client-JS; выбор ревизии — переход по ссылке
 * (searchParams-паттерн из docs/frontend-conventions.md §3.5).
 *
 * Переиспользуется слайсами events / banners / glossary / documents /
 * comments / annotations — доменную специфику сюда не добавлять.
 */
export async function RevisionHistory({
  revisions,
  selectedId,
  buildHref,
  children,
  title,
  emptyText,
  className,
}: RevisionHistoryProps) {
  const t = await getT("common");
  const resolvedTitle = title ?? t("revisionHistory.title");
  const resolvedEmptyText = emptyText ?? t("revisionHistory.empty");

  return (
    <section className={className} aria-label={resolvedTitle}>
      <h2 className="text-lg font-semibold">{resolvedTitle}</h2>
      {revisions.length === 0 ? (
        <p className="mt-2 text-sm text-(--color-fg-muted)">{resolvedEmptyText}</p>
      ) : (
        <ol className="mt-2 flex flex-col divide-y divide-(--color-border)">
          {revisions.map((rev) => {
            const selected = rev.id === selectedId;
            return (
              <li key={rev.id} className="py-1.5">
                <RouterLink
                  href={buildHref(rev.id)}
                  aria-current={selected ? "true" : undefined}
                  className={
                    selected
                      ? "text-sm font-semibold underline"
                      : "text-sm hover:underline"
                  }
                >
                  {formatCreatedAt(rev.createdAt)}
                  {rev.label ? ` — ${rev.label}` : ""}
                </RouterLink>
              </li>
            );
          })}
        </ol>
      )}
      {selectedId && children && (
        <div className="mt-4 rounded border border-(--color-border) p-4">
          {children}
        </div>
      )}
    </section>
  );
}
