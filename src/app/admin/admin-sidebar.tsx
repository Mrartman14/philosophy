"use client";
// src/app/admin/admin-sidebar.tsx
import { usePathname } from "next/navigation";

import { cn, RouterLink } from "@/components/ui";
import { useT } from "@/i18n/client";

/** Переводчик namespace "admin" (для типизации labelKey без server-only импорта). */
type AdminT = ReturnType<typeof useT<"admin">>;

export interface NavItem {
  href: string;
  /** Ключ внутри namespace "admin" (напр. "nav.lectures"); резолвится через useT. */
  labelKey: Parameters<AdminT>[0];
}

export function AdminSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const t = useT("admin");
  return (
    <nav aria-label={t("shellNavAriaLabel")} className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <RouterLink
            key={item.href}
            href={item.href}
            className={cn(
              "rounded px-2 py-1.5 text-sm transition",
              active
                ? "bg-(--color-fg) text-(--color-surface)"
                : "hover:bg-(--color-surface)",
            )}
          >
            {t(item.labelKey)}
          </RouterLink>
        );
      })}
    </nav>
  );
}
