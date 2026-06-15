"use client";
// src/features/audit/ui/audit-pagination.tsx
import { usePathname, useSearchParams } from "next/navigation";

import { RouterLink } from "@/components/ui";

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
 * Слайс-локальная пагинация. ui-kit `Pagination` строит href только из
 * offset и теряет фильтры; его docstring явно отдаёт сохранение прочих
 * searchParams на сторону потребителя, а src/components/ui — запретная
 * зона. Этот компонент мержит offset в ТЕКУЩИЙ query — фильтры выживают.
 */
export function AuditPagination({ offset, limit, total }: Props) {
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
        <RouterLink href={makeHref(Math.max(0, offset - limit))} className={linkCls}>
          ← Назад
        </RouterLink>
      ) : (
        <span className={disabledCls}>← Назад</span>
      )}
      <span className="text-(--color-description)">
        {total === 0
          ? "0 из 0"
          : `${offset + 1}–${Math.min(offset + limit, total)} из ${total}`}
      </span>
      {hasNext ? (
        <RouterLink href={makeHref(offset + limit)} className={linkCls}>
          Вперёд →
        </RouterLink>
      ) : (
        <span className={disabledCls}>Вперёд →</span>
      )}
    </nav>
  );
}
