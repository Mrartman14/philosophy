// src/app/admin/layout.tsx
import Link from "next/link";
import { forbidden } from "next/navigation";
import { getMe, type MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";
import { AdminSidebar, type NavItem } from "./admin-sidebar";

export const metadata = { title: "Админ-панель" };

/**
 * Полный набор пунктов админки. Каждый пункт гейтится capability'ями: пока
 * фича не появилась и бекенд не выдаёт capability, пункт не показывается.
 * Когда фича вкатывается — она заводит роут `app/admin/<entity>/`,
 * capability добавляется в RBAC, и пункт включается сам.
 *
 * Когда добавляется новая фича — расширяется этот файл (foundation update PR),
 * не каждой фичей в её собственном PR.
 */
function buildNavItems(me: MaybeMe): NavItem[] {
  const items: NavItem[] = [];
  if (
    can(me, "lecture.create") ||
    can(me, "lecture.update") ||
    can(me, "lecture.delete")
  ) {
    items.push({ href: "/admin/lectures", label: "Лекции" });
  }
  if (
    can(me, "glossary.create") ||
    can(me, "glossary.update") ||
    can(me, "glossary.delete")
  ) {
    items.push({ href: "/admin/glossary", label: "Глоссарий" });
  }
  if (
    can(me, "tag.create") ||
    can(me, "tag.update") ||
    can(me, "tag.delete")
  ) {
    items.push({ href: "/admin/tags", label: "Теги" });
  }
  if (can(me, "event.read")) {
    items.push({ href: "/admin/events", label: "События" });
  }
  if (can(me, "banner.read")) {
    items.push({ href: "/admin/banners", label: "Баннеры" });
  }
  if (can(me, "document.delete_any")) {
    items.push({ href: "/admin/documents", label: "Документы" });
  }
  if (can(me, "form.delete_any")) {
    items.push({ href: "/admin/forms", label: "Формы" });
  }
  if (can(me, "trail.delete_any")) {
    items.push({ href: "/admin/trails", label: "Маршруты" });
  }
  if (can(me, "share_link.moderate")) {
    items.push({ href: "/admin/share-links", label: "Ссылки" });
  }
  if (can(me, "comment.delete_any")) {
    items.push({ href: "/admin/comments", label: "Комментарии" });
  }
  if (can(me, "annotation.delete_any")) {
    items.push({ href: "/admin/annotations", label: "Аннотации" });
  }
  if (can(me, "user.list")) {
    items.push({ href: "/admin/users", label: "Пользователи" });
  }
  if (can(me, "push.send")) {
    items.push({ href: "/admin/push", label: "Push-уведомления" });
  }
  if (can(me, "audit.read")) {
    items.push({ href: "/admin/audit", label: "Аудит" });
  }
  return items;
}

/**
 * Гейт layout-уровня: только active-пользователь с любой админ-capability
 * проходит сюда. Доменные страницы дополнительно проверяют свою capability.
 */
function canAccessAdmin(me: MaybeMe): boolean {
  return can(me, "admin.access");
}

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
