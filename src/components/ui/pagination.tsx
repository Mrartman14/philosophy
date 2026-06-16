// src/components/ui/pagination.tsx
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
}: PaginationProps) {
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const prev = Math.max(0, offset - limit);
  const next = offset + limit;

  const linkCls = "rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)";
  const disabledCls = "rounded border border-(--color-border) px-3 py-1 opacity-40";

  return (
    <nav
      aria-label="Пагинация"
      className={cn("flex items-center gap-2 text-sm", className)}
    >
      {hasPrev ? (
        <RouterLink
          href={buildHref(basePath, offsetParam, prev, searchParams)}
          className={linkCls}
        >
          ← Назад
        </RouterLink>
      ) : (
        <span className={disabledCls}>
          ← Назад
        </span>
      )}
      <span className="text-(--color-description)">
        {total === 0
          ? "0 из 0"
          : `${offset + 1}–${Math.min(offset + limit, total)} из ${total}`}
      </span>
      {hasNext ? (
        <RouterLink
          href={buildHref(basePath, offsetParam, next, searchParams)}
          className={linkCls}
        >
          Вперёд →
        </RouterLink>
      ) : (
        <span className={disabledCls}>
          Вперёд →
        </span>
      )}
    </nav>
  );
}
