// src/app/admin/layout.tsx
import Link from "next/link";
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { AdminSidebar } from "./admin-sidebar";
import { buildNavItems, canAccessAdmin } from "./admin-access";

export const metadata = { title: "Админ-панель" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  if (!canAccessAdmin(me)) forbidden();

  const navItems = buildNavItems(me);

  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] w-full">
      <aside className="w-56 shrink-0 border-r border-(--color-border) bg-(--color-text-pane) p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-xs text-(--color-description) hover:underline"
          >
            ← На сайт
          </Link>
          <h2 className="text-lg font-bold">Админ-панель</h2>
          {me && (
            <span className="text-xs text-(--color-description) break-all">
              {me.username}
            </span>
          )}
        </div>
        <AdminSidebar items={navItems} />
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
