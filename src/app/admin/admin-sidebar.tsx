"use client";
// src/app/admin/admin-sidebar.tsx
import { usePathname } from "next/navigation";

import { cn, RouterLink } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
}

export function AdminSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Навигация админ-панели" className="flex flex-col gap-1">
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
                ? "bg-(--color-foreground) text-(--color-background)"
                : "hover:bg-(--color-background)",
            )}
          >
            {item.label}
          </RouterLink>
        );
      })}
    </nav>
  );
}
