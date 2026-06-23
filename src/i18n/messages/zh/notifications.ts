// src/i18n/messages/zh/notifications.ts
const notifications = {
  // --- Notification types (notification-item) ---
  documentUpdated: "您订阅的文档已更新",
  commentCreated: "{count, plural, other{# 条新评论}}",
  commentReply: "对您评论的回复",
  annotationCreated: "新批注",
  mention: "有人提到了您",
  fallback: "新通知",

  // --- Notification popover (notification-popover) ---
  popoverAriaLabel: "通知",
  popoverHeading: "通知",
  popoverViewAll: "全部",
  popoverLoading: "加载中…",
  popoverError: "无法加载通知。",
  popoverEmpty: "暂无通知。",

  // --- Bell button (notification-bell) ---
  bellAriaLabel: "通知",

  // --- List actions (notification-list-actions) ---
  markAllReadButton: "全部标为已读",
  markAllReadSuccess: "已全部标为已读",
  markAllSeenButton: "查看全部",
  markAllSeenSuccess: "已标为已查看",
  // Action for "You don't have permission to {action}." (Case 3)
  notificationsAction: "通知",

  // --- Subscribe button (subscribe-button, subscription-row) ---
  subscribeButton: "订阅",
  unsubscribeButton: "取消订阅",
  // Action for "You don't have permission to {action}." (Case 3)
  subscribeAction: "订阅",

  // --- Subscription row (subscription-row) ---
  documentPrefix: "文档",

  // --- Subscriptions section (subscriptions-section) ---
  subscriptionsError: "无法加载订阅。",
  subscriptionsEmpty: "您没有任何有效订阅。",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadNotificationsFailed: "无法加载通知",
    loadCountsFailed: "无法加载计数",
    loadSubscriptionsFailed: "无法加载订阅",
  },
};

export default notifications;
