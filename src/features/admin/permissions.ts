import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";
import { canModerateComments } from "@/features/comments/permissions";
import { canModerateAnnotations } from "@/features/annotations/permissions";

// Реэкспорт из feature-модулей: модерация — feature-level capability,
// а не admin-level. Нужны и локально (для getAdminNavItems ниже), и снаружи.
export { canModerateComments, canModerateAnnotations };

export function canAccessAdmin(me: MaybeMe): boolean {
  return can(me, "admin.access");
}

export function canListUsers(me: MaybeMe): boolean {
  return can(me, "user.list");
}

export function canModerateUsers(me: MaybeMe): boolean {
  return can(me, "user.moderate");
}

export function canSendPush(me: MaybeMe): boolean {
  return can(me, "push.send");
}

/**
 * Возвращает описание пунктов sidebar'а, доступных текущему пользователю.
 * Используется в `app/admin/layout.tsx` для серверной фильтрации меню.
 */
export interface AdminNavItem {
  href: string;
  label: string;
  exact: boolean;
}

export function getAdminNavItems(me: MaybeMe): AdminNavItem[] {
  const items: AdminNavItem[] = [
    { href: "/admin", label: "Дашборд", exact: true },
  ];
  if (can(me, "lecture.update") || can(me, "lecture.create")) {
    items.push({ href: "/admin/lectures", label: "Лекции", exact: false });
  }
  if (canListUsers(me)) {
    items.push({ href: "/admin/users", label: "Пользователи", exact: false });
  }
  if (canModerateComments(me)) {
    items.push({
      href: "/admin/comments",
      label: "Комментарии",
      exact: false,
    });
  }
  if (canModerateAnnotations(me)) {
    items.push({
      href: "/admin/annotations",
      label: "Аннотации",
      exact: false,
    });
  }
  if (canSendPush(me)) {
    items.push({ href: "/admin/push", label: "Push", exact: false });
  }
  return items;
}
