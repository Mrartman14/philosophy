// src/i18n/messages/ar/notifications.ts
const notifications = {
  // --- Notification types (notification-item) ---
  documentUpdated:
    "{count, plural, zero{تم تحديث مستند تتابعه} one{تم تحديث مستند تتابعه} two{تم تحديث مستند تتابعه مرتين} few{تم تحديث مستند تتابعه # مرات} many{تم تحديث مستند تتابعه # مرة} other{تم تحديث مستند تتابعه # مرة}}",
  lectureUpdated:
    "{count, plural, zero{تم تحديث محاضرة تتابعها} one{تم تحديث محاضرة تتابعها} two{تم تحديث محاضرة تتابعها مرتين} few{تم تحديث محاضرة تتابعها # مرات} many{تم تحديث محاضرة تتابعها # مرة} other{تم تحديث محاضرة تتابعها # مرة}}",
  canvasUpdated:
    "{count, plural, zero{تم تحديث لوحة تتابعها} one{تم تحديث لوحة تتابعها} two{تم تحديث لوحة تتابعها مرتين} few{تم تحديث لوحة تتابعها # مرات} many{تم تحديث لوحة تتابعها # مرة} other{تم تحديث لوحة تتابعها # مرة}}",
  commentReplied:
    "{count, plural, zero{رد جديد على تعليقك} one{رد جديد على تعليقك} two{ردّان جديدان على تعليقك} few{# ردود جديدة على تعليقك} many{# ردًّا جديدًا على تعليقك} other{# رد جديد على تعليقك}}",
  fallback: "إشعار جديد",
  byActor: "بواسطة {actor}",

  // --- Notification popover (notification-popover) ---
  popoverAriaLabel: "الإشعارات",
  popoverHeading: "الإشعارات",
  popoverViewAll: "الكل",
  popoverLoading: "جارٍ التحميل…",
  popoverError: "تعذّر تحميل الإشعارات.",
  popoverEmpty: "لا توجد إشعارات بعد.",

  // --- Bell button (notification-bell) ---
  bellAriaLabel: "الإشعارات",

  // --- List actions (notification-list-actions) ---
  markAllReadButton: "تحديد الكل كمقروء",
  markAllReadSuccess: "تم تحديد الكل كمقروء",
  markAllSeenButton: "عرض الكل",
  markAllSeenSuccess: "تم التحديد كمعروض",
  // Action for "You don't have permission to {action}." (Case 3)
  notificationsAction: "الإشعارات",

  // --- Subscribe button (subscribe-button, subscription-row) ---
  subscribeButton: "اشتراك",
  unsubscribeButton: "إلغاء الاشتراك",
  // Action for "You don't have permission to {action}." (Case 3)
  subscribeAction: "الاشتراك",

  // --- Subscription row (subscription-row) ---
  documentPrefix: "مستند",

  // --- Subscriptions section (subscriptions-section) ---
  subscriptionsError: "تعذّر تحميل الاشتراكات.",
  subscriptionsEmpty: "ليس لديك اشتراكات نشطة.",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadNotificationsFailed: "تعذّر تحميل الإشعارات",
    loadCountsFailed: "تعذّر تحميل العدّادات",
    loadSubscriptionsFailed: "تعذّر تحميل الاشتراكات",
  },
};

export default notifications;
