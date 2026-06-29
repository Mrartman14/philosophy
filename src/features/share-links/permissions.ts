// src/features/share-links/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";

/**
 * Минимальная форма ресурса для проверки права создать ссылку.
 * owner_id и visibility приходят в payload lecture/document/media/trail/form.
 */
export interface ShareableResource {
  owner?: { id?: string | null } | undefined;
  visibility?: string;
}

/**
 * Создать ссылку может ТОЛЬКО владелец ПРИВАТНОГО ресурса.
 *
 * Сверено с philosophy-api internal/sharelink/service.go:41-96:
 * - capability НЕ требуется (Create не зовёт HasCapability);
 * - ownerID == actor.UserID, иначе бек вернёт 404 (NotFound("resource"));
 * - visibility == "private", иначе 422 RESOURCE_NOT_PRIVATE.
 * isMutationAllowed покрывает гостя и suspended/banned (status !== active).
 */
export function canCreateShareLink(
  me: MaybeMe,
  resource: ShareableResource,
): boolean {
  if (!isMutationAllowed(me)) return false;
  if (!resource.owner?.id || resource.owner.id !== me.id) return false;
  return resource.visibility === "private";
}

/**
 * Модерация чужих ссылок (admin-страница, admin-revoke).
 *
 * Капа "share_link.moderate" сверена с philosophy-api
 * internal/rbac/capabilities.go (CapShareLinkModerate). Чек делегирован
 * `can()`: гость → false, не-active → false, иначе членство в capabilities
 * (status-гейт внутри can()).
 */
export function canModerateShareLinks(me: MaybeMe): boolean {
  return can(me, "share_link.moderate");
}

/**
 * Управлять своими ссылками (список + revoke) может любой залогиненный
 * active-пользователь. Owner-чек самих ссылок делает бек (404 на чужие).
 */
export function canManageOwnLinks(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
