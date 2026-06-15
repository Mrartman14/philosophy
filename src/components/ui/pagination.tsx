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
}

/**
 * Простая offset/limit пагинация на URL searchParams. SSR-friendly: просто
 * рендерит ссылки, никакого client state. `basePath` — путь без query.
 * Существующие searchParams сохраняются автоматически на стороне Next.js
 * при использовании `<RouterLink>` с относительным href; если нужно сохранить
 * дополнительные фильтры — переключить на `searchParams.toString()` на
 * стороне страницы.
 */
export function Pagination({
  basePath,
  offsetParam = "offset",
  offset,
  limit,
  total,
  className,
}: PaginationProps) {
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const prev = Math.max(0, offset - limit);
  const next = offset + limit;

  return (
    <nav
      aria-label="Пагинация"
      className={cn("flex items-center gap-2 text-sm", className)}
    >
      {hasPrev ? (
        <RouterLink
          href={`${basePath}?${offsetParam}=${prev}`}
          className="rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)"
        >
          ← Назад
        </RouterLink>
      ) : (
        <span className="rounded border border-(--color-border) px-3 py-1 opacity-40">
          ← Назад
        </span>
      )}
      <span className="text-(--color-description)">
        {offset + 1}–{Math.min(offset + limit, total)} из {total}
      </span>
      {hasNext ? (
        <RouterLink
          href={`${basePath}?${offsetParam}=${next}`}
          className="rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)"
        >
          Вперёд →
        </RouterLink>
      ) : (
        <span className="rounded border border-(--color-border) px-3 py-1 opacity-40">
          Вперёд →
        </span>
      )}
    </nav>
  );
}
