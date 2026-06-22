// src/components/ui/pagination.tsx
import { ChevronIcon } from "@/assets/icons/chevron-icon";

import { cn } from "./cn";
import { RouterLink } from "./router-link";


interface PaginationProps {
  basePath: string;
  /** Имя query-параметра для offset. По умолчанию "offset". */
  offsetParam?: string;
  offset: number;
  limit: number;
  total: number;
  className?: string;
  /**
   * Уже ожидённые searchParams страницы (Record из Next.js
   * `Promise<searchParams>`). Когда переданы — offset вмержается в эти
   * параметры (прочие фильтры сохраняются); при offset === 0 параметр
   * удаляется (не добавляется `?offset=0`). Когда не переданы — используется
   * старое поведение: `basePath?<offsetParam>=<value>`.
   */
  searchParams?: Record<string, string | string[] | undefined>;
  /**
   * Локализованные подписи. Компонент рендерится в SERVER-компонентах
   * (списки/таблицы), поэтому не может тянуть `useT` сам без поломки
   * server/client-границы. Caller-сервер резолвит их через `getT("common")`
   * и пробрасывает (см. `paginationLabels` в `@/components/ui`). Без пропа —
   * ru-дефолты (back-compat для dev/демо-callsites).
   */
  labels?: PaginationLabels;
}

export interface PaginationLabels {
  ariaLabel: string;
  prev: string;
  next: string;
  /** Шаблон диапазона с плейсхолдерами `{from}` `{to}` `{total}`. */
  range: string;
  /** Текст при `total === 0`. */
  rangeEmpty: string;
}

const RU_DEFAULT_LABELS: PaginationLabels = {
  ariaLabel: "Пагинация",
  prev: "Назад",
  next: "Вперёд",
  range: "{from}–{to} из {total}",
  rangeEmpty: "0 из 0",
};

function formatRange(template: string, from: number, to: number, total: number): string {
  return template
    .replace("{from}", String(from))
    .replace("{to}", String(to))
    .replace("{total}", String(total));
}

function buildHref(
  basePath: string,
  offsetParam: string,
  nextOffset: number,
  searchParams: Record<string, string | string[] | undefined> | undefined,
): string {
  if (searchParams !== undefined) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const s of v) p.append(k, s);
      } else {
        p.set(k, v);
      }
    }
    if (nextOffset > 0) {
      p.set(offsetParam, String(nextOffset));
    } else {
      p.delete(offsetParam);
    }
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }
  // Старое поведение — backward-compat для существующих потребителей.
  return `${basePath}?${offsetParam}=${nextOffset}`;
}

/**
 * Простая offset/limit пагинация на URL searchParams. SSR-friendly: просто
 * рендерит ссылки, никакого client state. `basePath` — путь без query.
 *
 * Для сохранения прочих фильтров передайте `searchParams` (уже ожидённый
 * объект из пропа страницы). Тогда offset вмержается в текущие параметры, а
 * при offset === 0 он опускается (нет `?offset=0`). Без `searchParams` — старое
 * поведение: href = `basePath?offset=N`.
 *
 * При `total === 0` рендерится «0 из 0» вместо «1–0 из 0».
 */
export function Pagination({
  basePath,
  offsetParam = "offset",
  offset,
  limit,
  total,
  className,
  searchParams,
  labels = RU_DEFAULT_LABELS,
}: PaginationProps) {
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const prev = Math.max(0, offset - limit);
  const next = offset + limit;

  const linkCls = "rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-surface-subtle)";
  const disabledCls = "rounded border border-(--color-border) px-3 py-1 opacity-40";

  return (
    <nav
      aria-label={labels.ariaLabel}
      className={cn("flex items-center gap-2 text-sm", className)}
    >
      {hasPrev ? (
        <RouterLink
          href={buildHref(basePath, offsetParam, prev, searchParams)}
          className={cn(linkCls, "inline-flex items-center gap-1")}
        >
          <ChevronIcon className="rtl-flip rotate-180" />
          {labels.prev}
        </RouterLink>
      ) : (
        <span className={cn(disabledCls, "inline-flex items-center gap-1")}>
          <ChevronIcon className="rtl-flip rotate-180" />
          {labels.prev}
        </span>
      )}
      <span className="text-(--color-fg-muted)">
        {total === 0
          ? labels.rangeEmpty
          : formatRange(labels.range, offset + 1, Math.min(offset + limit, total), total)}
      </span>
      {hasNext ? (
        <RouterLink
          href={buildHref(basePath, offsetParam, next, searchParams)}
          className={cn(linkCls, "inline-flex items-center gap-1")}
        >
          {labels.next}
          <ChevronIcon className="rtl-flip" />
        </RouterLink>
      ) : (
        <span className={cn(disabledCls, "inline-flex items-center gap-1")}>
          {labels.next}
          <ChevronIcon className="rtl-flip" />
        </span>
      )}
    </nav>
  );
}
