// src/features/notifications/index.ts
// Public API слайса notifications.
export {
  getNotifications,
  getNotificationCounts,
  getSubscriptions,
  getDocumentSubscription,
  getLectureSubscription,
} from "./api";
export {
  markRead,
  markAllRead,
  markAllSeen,
  subscribeDocument,
  unsubscribeDocument,
  subscribeLecture,
  unsubscribeLecture,
  fetchNotificationCounts,
  fetchNotifications,
} from "./actions";
export { canUseNotifications, canManageSubscriptions } from "./permissions";

// UI (создаются в фазах 2-3):
export { NotificationBell } from "./ui/notification-bell";
export { NotificationItem } from "./ui/notification-item";
export { NotificationListActions } from "./ui/notification-list-actions";
export { DocumentSubscribeButton } from "./ui/document-subscribe-button";
export { LectureSubscribeButton } from "./ui/lecture-subscribe-button";
export { SubscriptionsSection } from "./ui/subscriptions-section";

export type {
  AppNotification,
  NotificationCounts,
  DocumentSubscription,
  NotificationListResult,
  SubscriptionListResult,
} from "./types";
