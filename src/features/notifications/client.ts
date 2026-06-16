// src/features/notifications/client.ts
// Client-safe entry: чистый рендерер + типы. НЕ реэкспортит api/actions/permissions.
export { renderNotification, type RenderedNotification } from "./notification-content";
export type {
  AppNotification,
  NotificationCounts,
  DocumentSubscription,
  NotificationListResult,
  SubscriptionListResult,
} from "./types";
