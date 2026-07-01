// src/i18n/messages/en/notifications.ts
const notifications = {
  // --- Notification types (notification-item) ---
  documentUpdated:
    "{count, plural, one{A document you follow was updated} other{A document you follow was updated # times}}",
  lectureUpdated:
    "{count, plural, one{A lecture you follow was updated} other{A lecture you follow was updated # times}}",
  canvasUpdated:
    "{count, plural, one{A canvas you follow was updated} other{A canvas you follow was updated # times}}",
  commentReplied:
    "{count, plural, one{New reply to your comment} other{# new replies to your comment}}",
  fallback: "New notification",
  byActor: "by {actor}",

  // --- Notification popover (notification-popover) ---
  popoverAriaLabel: "Notifications",
  popoverHeading: "Notifications",
  popoverViewAll: "All",
  popoverLoading: "Loading…",
  popoverError: "Failed to load notifications.",
  popoverEmpty: "No notifications yet.",

  // --- Bell button (notification-bell) ---
  bellAriaLabel: "Notifications",

  // --- List actions (notification-list-actions) ---
  markAllReadButton: "Mark all as read",
  markAllReadSuccess: "All marked as read",
  markAllSeenButton: "View all",
  markAllSeenSuccess: "Marked as viewed",
  // Action for "You don't have permission to {action}." (Case 3)
  notificationsAction: "notifications",

  // --- Subscribe button (subscribe-button, subscription-row) ---
  subscribeButton: "Subscribe",
  unsubscribeButton: "Unsubscribe",
  // Action for "You don't have permission to {action}." (Case 3)
  subscribeAction: "subscription",

  // --- Subscription row (subscription-row) ---
  documentPrefix: "Document",

  // --- Subscriptions section (subscriptions-section) ---
  subscriptionsError: "Failed to load subscriptions.",
  subscriptionsEmpty: "You have no active subscriptions.",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadNotificationsFailed: "Failed to load notifications",
    loadCountsFailed: "Failed to load counts",
    loadSubscriptionsFailed: "Failed to load subscriptions",
  },
};

export default notifications;
