// src/features/notifications/types.ts
import type { components } from "@/api/schema";

/** Сырые DTO из сгенерированной схемы (для нормализаторов в api.ts). */
export type NotificationDTO = components["schemas"]["notification.Notification"];
export type SubscriptionDTO = components["schemas"]["notification.Subscription"];

/** Нормализованное уведомление: optional-поля DTO сведены к не-optional с дефолтами. */
export interface AppNotification {
  id: string;
  type: string;
  reason: string;
  actorId: string | null;
  targetId: string | null;
  targetType: string | null;
  targetVersion: number | null;
  groupCount: number;
  readAt: string | null;
  seenAt: string | null;
  createdAt: string | null;
}

export interface NotificationCounts {
  unread: number;
  unseen: number;
}

export interface DocumentSubscription {
  id: string;
  targetId: string;
  targetType: string;
  createdAt: string | null;
}
