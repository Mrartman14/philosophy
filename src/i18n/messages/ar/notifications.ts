// src/i18n/messages/ar/notifications.ts
const notifications = {
  // --- Notification types (notification-item) ---
  documentUpdated: "تم تحديث مستند تتابعه",
  commentCreated:
    "{count, plural, zero{لا تعليقات جديدة} one{تعليق جديد واحد} two{تعليقان جديدان} few{# تعليقات جديدة} many{# تعليقًا جديدًا} other{# تعليق جديد}}",
  commentReply: "رد على تعليقك",
  annotationCreated: "تعليق توضيحي جديد",
  mention: "تمت الإشارة إليك",
  fallback: "إشعار جديد",

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
