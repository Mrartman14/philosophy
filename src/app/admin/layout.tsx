import Link from "next/link";
import { getUser } from "@/utils/get-user";
import { AdminSidebar } from "@/features/admin/admin-sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getUser();
  // Middleware уже гарантирует, что сюда попадают только admin,
  // но getUser нужен для отображения id в шапке.

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
          {user && (
            <span className="text-xs text-(--color-description) break-all">
              {user.id}
            </span>
          )}
        </div>
        <AdminSidebar />
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
