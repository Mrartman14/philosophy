"use client";
// src/components/shared/nav-rail.tsx
import { usePathname } from "next/navigation";

import { cn, RouterLink } from "@/components/ui";

export interface NavRailItem {
  href: string;
  label: string;
}

const ORIENTATION = {
  /** Всегда колонка — сайдбар админки. */
  vertical: "flex flex-col gap-1",
  /** Строка-чипы на мобиле, колонка с lg — сайдбар /me. */
  responsive: "flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap",
} as const;

/**
 * Shared нав-панель с подсветкой активного пункта. Active-логика (`usePathname`)
 * живёт ТОЛЬКО здесь — потребители (/me, /admin) резолвят лейблы server-side и
 * прокидывают их строками, поэтому компонент развязан от i18n-namespace.
 *
 * - `match="prefix"` (default) — активен текущий и вложенные пути
 *   (`/admin/lectures` подсвечен и на `/admin/lectures/42`). `"exact"` —
 *   строгое равенство (для сиблингов, где один href — префикс другого).
 * - `orientation` — см. `ORIENTATION`.
 * - `aria-current="page"` ставится на активном пункте (a11y «вы здесь»).
 */
export function NavRail({
  items,
  ariaLabel,
  orientation = "vertical",
  match = "prefix",
  className,
}: {
  items: NavRailItem[];
  ariaLabel: string;
  orientation?: keyof typeof ORIENTATION;
  match?: "prefix" | "exact";
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={ariaLabel} className={cn(ORIENTATION[orientation], className)}>
      {items.map((item) => {
        const active =
          match === "exact"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <RouterLink
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded px-3 py-1.5 text-sm transition",
              active
                ? "bg-(--color-accent) text-(--color-surface)"
                : "text-(--color-fg-muted) hover:bg-(--color-surface-raised) hover:text-(--color-accent)",
            )}
          >
            {item.label}
          </RouterLink>
        );
      })}
    </nav>
  );
}
