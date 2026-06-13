"use client";
// src/features/media/ui/media-pagination.tsx
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Props {
  offset: number;
  limit: number;
  total: number;
}

const linkCls =
  "rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)";
const disabledCls =
  "rounded border border-(--color-border) px-3 py-1 opacity-40";

/**
 * Слайс-локальная пагинация. ui-kit Pagination строит href только из offset
 * и теряет прочие searchParams; src/components/ui — запретная зона. Этот
 * компонент мержит offset в ТЕКУЩИЙ query (например, free_floating выживает).
 */
export function MediaPagination({ offset, limit, total }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function makeHref(nextOffset: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    else params.delete("offset");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav aria-label="Пагинация" className="flex items-center gap-2 text-sm">
      {hasPrev ? (
        <Link href={makeHref(Math.max(0, offset - limit))} className={linkCls}>
          ← Назад
        </Link>
      ) : (
        <span className={disabledCls}>← Назад</span>
      )}
      <span className="text-(--color-description)">
        {total === 0
          ? "0 из 0"
          : `${offset + 1}–${Math.min(offset + limit, total)} из ${total}`}
      </span>
      {hasNext ? (
        <Link href={makeHref(offset + limit)} className={linkCls}>
          Вперёд →
        </Link>
      ) : (
        <span className={disabledCls}>Вперёд →</span>
      )}
    </nav>
  );
}
