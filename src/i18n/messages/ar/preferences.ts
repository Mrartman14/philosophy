// src/i18n/messages/ar/preferences.ts
// Mirror of ru/preferences.ts.
const preferences = {
  // --- preferences-form ---
  readingModeLabel: "وضع القراءة",
  readingModeDescription:
    "يُخفي الوضع «المركَّز» العناصر الثانوية في صفحة المحاضرة.",
  readingModeAriaLabel: "وضع القراءة",
  readingModeFull: "كامل",
  readingModeFocused: "مركَّز",
  settingsSaved: "تم حفظ الإعدادات.",
  saveButton: "حفظ",
  // Action phrase for "You don't have permission for {action}."
  updateSettingsAction: "تغيير الإعدادات",

  // --- comment-reply-notify-toggle ---
  commentReplyNotifyLabel: "أبلغني بالردود على تعليقاتي",
  commentReplyNotifyDescription:
    "تصلك إشعارات عندما يرد أحدهم على تعليقك.",
  commentReplyNotifySaved: "تم حفظ الإعداد.",

  // --- push-send-form ---
  pushTitleLabel: "العنوان",
  pushBodyLabel: "النص",
  pushUrlLabel: "الرابط",
  pushUrlDescription:
    "يُفتح عند النقر على الإشعار. مسار («/lectures/…») أو رابط http(s) كامل.",
  pushTitlePlaceholder: "مثال: «محاضرة جديدة»",
  pushSendAccepted: "تم قبول الإرسال وسيُسلَّم إلى المشتركين في الخلفية.",
  pushSendButton: "إرسال",
  // Action phrase for "You don't have permission for {action}."
  pushSendAction: "إرسال إشعارات الدفع",

  // --- push-subscription-toggle ---
  pushCheckingSubscription: "جارٍ التحقق من الاشتراك…",
  pushUnsupported: "إشعارات الدفع غير مدعومة في هذا المتصفح.",
  pushDenied: "الإشعارات محظورة. اسمح بها في إعدادات المتصفح.",
  pushUnavailable: "إشعارات الدفع غير متوفرة مؤقتًا.",
  pushSubscribed: "أنت مشترك في الإشعارات.",
  pushNotSubscribed: "أنت غير مشترك في الإشعارات.",
  pushUnsubscribeButton: "إلغاء الاشتراك",
  pushSubscribeButton: "اشتراك",
  pushNoPermission: "ليست لديك صلاحية الاشتراك في الإشعارات.",
  pushSubscribeError: "تعذَّر إنشاء الاشتراك. حاول مرة أخرى.",
  pushUnsubscribeError: "تعذَّر إلغاء الاشتراك. حاول مرة أخرى.",
  // Action phrase for "You don't have permission for {action}."
  pushSubscribeAction: "الاشتراك في الإشعارات",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadFailed: "تعذَّر تحميل التفضيلات",
  },
};

export default preferences;
