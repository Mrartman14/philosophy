// src/features/notifications/notification-content.ts
// Чистый client-safe дескриптор уведомления. Текст рендерится в компоненте через @/i18n.
import type { AppNotification } from "./types";

/** Дискриминированный дескриптор: какой ключ каталога рендерить + куда вести. */
export type NotificationDescriptor =
  | { kind: "documentUpdated"; href: string | null }
  | { kind: "commentCreated"; count: number; href: string | null }
  | { kind: "commentReply"; href: string | null }
  | { kind: "annotationCreated"; href: string | null }
  | { kind: "mention"; href: string | null }
  | { kind: "raw"; text: string; count: number; href: string | null };

/** Fallback-ссылка на сущность по target_type. */
function entityHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetId) return null;
  switch (targetType) {
    case "document":
      return `/documents/${targetId}`;
    case "lecture":
      return `/lectures/${targetId}`;
    case "annotation":
      return "/me/annotations"; // detail-страницы аннотации нет — ведём в список
    default:
      return null;
  }
}

/**
 * Маппинг type → дескриптор. Тексты НЕ здесь (они в каталоге @/i18n).
 * TODO(backend-ask): сверить значения `type` с philosophy-api.
 */
export function describeNotification(n: AppNotification): NotificationDescriptor {
  const href = entityHref(n.targetType, n.targetId);
  switch (n.type) {
    case "document.updated":
      return { kind: "documentUpdated", href };
    case "comment.created":
      return { kind: "commentCreated", count: n.groupCount, href };
    case "comment.reply":
      return { kind: "commentReply", href };
    case "annotation.created":
      return { kind: "annotationCreated", href };
    case "mention":
      return { kind: "mention", href };
    default:
      return { kind: "raw", text: n.reason, count: n.groupCount, href };
  }
}
