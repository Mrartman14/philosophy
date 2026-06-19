// src/i18n/messages/en/notifications.ts
const notifications = {
  // --- Notification types (notification-item) ---
  documentUpdated: "A document you follow was updated",
  commentCreated: "{count, plural, one{# new comment} other{# new comments}}",
  commentReply: "A reply to your comment",
  annotationCreated: "New annotation",
  mention: "You were mentioned",
  fallback: "New notification",

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
};

export default notifications;
