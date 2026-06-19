// src/features/notifications/client.ts
// Client-safe entry: дескриптор + типы. НЕ реэкспортит api/actions/permissions.
export { describeNotification, type NotificationDescriptor } from "./notification-content";
export type {
  AppNotification,
  NotificationCounts,
  DocumentSubscription,
  NotificationListResult,
  SubscriptionListResult,
} from "./types";
