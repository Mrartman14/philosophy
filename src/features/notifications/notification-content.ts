// src/features/notifications/notification-content.ts
// Чистый client-safe дескриптор уведомления. Текст рендерится в компоненте через @/i18n.
import type { AppNotification, NotificationTargetType } from "./types";

/**
 * Дискриминированный дескриптор: какой ключ каталога рендерить + куда вести.
 * `count` = group_count (сгруппированные уведомления: сущность обновлена N раз) —
 * для ICU-плюрализации сообщения в notification-item.
 */
export type NotificationDescriptor =
  | { kind: "documentUpdated"; count: number; href: string | null }
  | { kind: "lectureUpdated"; count: number; href: string | null }
  | { kind: "canvasUpdated"; count: number; href: string | null }
  // commentReplied НЕ несёт href: у коммента нет своей страницы, хост-лекцию
  // резолвим по клику (см. notification-item → resolveCommentReplyHref), чтобы не
  // делать N+1 GET /api/comments/{id} на рендере ленты. commentId = id ответа.
  | { kind: "commentReplied"; count: number; commentId: string | null }
  | { kind: "raw"; count: number; href: string | null };

/** Fallback-ссылка на сущность по target_type. */
function entityHref(
  targetType: NotificationTargetType | null,
  targetId: string | null,
): string | null {
  if (!targetId) return null;
  switch (targetType) {
    case "document":
      return `/documents/${targetId}`;
    case "lecture":
      return `/lectures/${targetId}`;
    case "canvas":
      return `/canvases/${targetId}`;
    default:
      return null;
  }
}

/**
 * Маппинг type → дескриптор. Тексты НЕ здесь (они в каталоге @/i18n).
 *
 * Бек контрактует ровно три типа уведомлений (`notification.Type`):
 * подписка на сущность → её обновление (reason всегда `subscribed`). `default`
 * оставлен как graceful raw-fallback на случай, если бек добавит новый тип
 * раньше, чем FE перегенерирует схему (TS считает ветку недостижимой — это ок).
 */
export function describeNotification(n: AppNotification): NotificationDescriptor {
  const href = entityHref(n.targetType, n.targetId);
  const count = n.groupCount;
  switch (n.type) {
    case "document.updated":
      return { kind: "documentUpdated", count, href };
    case "lecture.updated":
      return { kind: "lectureUpdated", count, href };
    case "canvas.updated":
      return { kind: "canvasUpdated", count, href };
    case "comment.replied":
      // targetId = id ответа. Хост-лекцию и итоговый href резолвим по клику.
      return { kind: "commentReplied", count, commentId: n.targetId };
    default:
      return { kind: "raw", count, href };
  }
}
