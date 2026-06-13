// src/features/share-links/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Минимальная форма ресурса для проверки права создать ссылку.
 * owner_id и visibility приходят в payload lecture/document/media/trail/form.
 */
export interface ShareableResource {
  owner_id?: string;
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
  if (!resource.owner_id || resource.owner_id !== me.id) return false;
  return resource.visibility === "private";
}

/**
 * Модерация чужих ссылок (admin-страница, admin-revoke).
 *
 * Капа "share_link.moderate" (philosophy-api rbac/capabilities.go:52) НЕ входит
 * в union Capability (src/utils/permissions.ts заморожен — foundation-зона),
 * поэтому проверяем членство в capabilities напрямую. После foundation-touch,
 * добавляющего капу в union, этот хелпер можно заменить на can(me, ...).
 */
export function canModerateShareLinks(me: MaybeMe): boolean {
  if (!isMutationAllowed(me)) return false;
  return me.capabilities.includes("share_link.moderate");
}

/**
 * Управлять своими ссылками (список + revoke) может любой залогиненный
 * active-пользователь. Owner-чек самих ссылок делает бек (404 на чужие).
 */
export function canManageOwnLinks(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
