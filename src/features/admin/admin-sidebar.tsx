"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavItem } from "@/features/admin/permissions";

interface AdminSidebarProps {
  items: AdminNavItem[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ items }) => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              isActive
                ? "bg-(--color-primary) text-(--color-background)"
                : "hover:bg-(--color-background)"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};
