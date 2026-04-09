import Link from "next/link";
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canAccessAdmin,
  getAdminNavItems,
} from "@/features/admin/permissions";
import { AdminSidebar } from "@/features/admin/admin-sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const me = await getMe();
  if (!canAccessAdmin(me)) {
    forbidden(); // Next.js рендерит 403 (forbidden.tsx или дефолт).
  }

  const navItems = getAdminNavItems(me);

  return (
    <div className="flex min-h-screen">
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
