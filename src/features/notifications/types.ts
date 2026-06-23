// src/features/notifications/types.ts
import type { components } from "@/api/schema";

/** Сырые DTO из сгенерированной схемы (для нормализаторов в api.ts). */
export type NotificationDTO = components["schemas"]["notification.Notification"];
export type SubscriptionDTO = components["schemas"]["notification.Subscription"];

/**
 * Сгенерированные enum'ы уведомлений (бек навесил swaggo-enum). Источник истины —
 * `schema.ts`: новый вариант на беке → regen краснит сборку там, где switch не
 * исчерпывающ. Нормализованная модель моделирует «бек опустил/прислал unknown»
 * как `null` (без фейковых дефолтов) — дескриптор отдаёт graceful raw-fallback.
 */
export type NotificationType = components["schemas"]["notification.Type"];
export type NotificationTargetType = components["schemas"]["notification.TargetType"];
export type NotificationReason = components["schemas"]["notification.Reason"];

/** Нормализованное уведомление: optional-поля DTO сведены к не-optional с дефолтами. */
export interface AppNotification {
  id: string;
  type: NotificationType | null;
  reason: NotificationReason | null;
  actorId: string | null;
  targetId: string | null;
  targetType: NotificationTargetType | null;
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
  targetType: NotificationTargetType | null;
  createdAt: string | null;
}

export interface NotificationListResult {
  items: AppNotification[];
  total: number;
  offset: number;
  limit: number;
}

export interface SubscriptionListResult {
  items: DocumentSubscription[];
  total: number;
  offset: number;
  limit: number;
}
