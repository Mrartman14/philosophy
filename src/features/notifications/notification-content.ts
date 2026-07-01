// src/features/notifications/notification-content.ts
// Чистый client-safe дескриптор уведомления. Текст рендерится в компоненте через @/i18n.
import { commentHash } from "@/utils/comment-anchor";

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
  | { kind: "commentReplied"; count: number; href: string | null }
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
    case "comment.replied": {
      // Коммент живёт в /lectures/{id}; deep-link по стабильному DOM-контракту
      // comment-<id> (см. comment-tree.tsx / thread-scroll.ts). null-хост → нет ссылки.
      const commentHref =
        n.commentLectureId && n.targetId
          ? `/lectures/${n.commentLectureId}${commentHash(n.targetId)}`
          : null;
      return { kind: "commentReplied", count, href: commentHref };
    }
    default:
      return { kind: "raw", count, href };
  }
}
