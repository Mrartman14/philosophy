import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

import type { NavItem } from "./admin-sidebar";

/**
 * Полный набор пунктов админки. Каждый пункт гейтится capability'ями: пока
 * фича не появилась и бекенд не выдаёт capability, пункт не показывается.
 *
 * ⚠️ Эти capability ОПРЕДЕЛЯЮТ admin-границу (см. `canAccessAdmin`). Не гейти
 * нав-итемы на user-capability (canvas.create / form.create / annotation.create
 * / comment.create / document.create / media.create / trail.create /
 * entity.attach) — иначе admin-shell молча откроется всем active-юзерам.
 * Инвариант проверяется тестом «нав-cap ∩ RoleUser = ∅».
 */
export function buildNavItems(me: MaybeMe): NavItem[] {
  const items: NavItem[] = [];
  // lecture.update не существует в rbac.Capability — ветка опущена (был дрейф).
  if (can(me, "lecture.create") || can(me, "lecture.delete")) {
    items.push({ href: "/admin/lectures", label: "Лекции" });
  }
  if (
    can(me, "glossary.create") ||
    can(me, "glossary.update") ||
    can(me, "glossary.delete")
  ) {
    items.push({ href: "/admin/glossary", label: "Глоссарий" });
  }
  if (can(me, "tag.create") || can(me, "tag.update") || can(me, "tag.delete")) {
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
 * Гейт layout-уровня: пускает active-пользователя с любой админ-capability.
 * Производный от `buildNavItems` (пустой список ⇒ нет ни одного админ-права).
 * Status-гейт (suspended/banned) держится на `can()` внутри `buildNavItems`,
 * который режет не-`active` (см. `permissions.ts`).
 */
export function canAccessAdmin(me: MaybeMe): boolean {
  return buildNavItems(me).length > 0;
}
