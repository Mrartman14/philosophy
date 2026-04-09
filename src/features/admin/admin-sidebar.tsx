"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Дашборд", exact: true },
  { href: "/admin/lectures", label: "Лекции", exact: false },
  { href: "/admin/users", label: "Пользователи", exact: false },
  { href: "/admin/comments", label: "Комментарии", exact: false },
  { href: "/admin/annotations", label: "Аннотации", exact: false },
  { href: "/admin/push", label: "Push", exact: false },
];

export const AdminSidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
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
