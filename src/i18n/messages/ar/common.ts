// src/i18n/messages/ar/common.ts
// Common UI strings: navigation, statuses, component templates.
const common = {
  // Navigation (app-header, app-nav)
  nav: {
    lectures: "المحاضرات",
    calendar: "التقويم",
    trails: "المسارات",
    canvases: "اللوحات",
    login: "تسجيل الدخول",
  },

  // install-banner
  installBanner: {
    installApp: "ثبّت التطبيق على جهازك",
    install: "تثبيت",
    iosHint: "اضغط على «مشاركة» ⎋ ← «إضافة إلى الشاشة الرئيسية» للتثبيت",
  },

  // network-indicator
  networkIndicator: {
    offline: "لا يوجد اتصال",
  },

  // update-prompt
  updatePrompt: {
    updateAvailable: "يتوفّر تحديث",
    update: "تحديث",
  },

  // shared/go-back
  back: "رجوع",

  // UI-kit: pagination (rendered in server components — resolved via getT on the
  // caller side and passed through the labels prop)
  pagination: {
    ariaLabel: "ترقيم الصفحات",
    prev: "السابق",
    next: "التالي",
    range: "{from}–{to} من {total}",
    rangeEmpty: "0 من 0",
  },

  // UI-kit: confirm-dialog (client)
  confirmDialog: {
    confirm: "تأكيد",
    cancel: "إلغاء",
  },

  // UI-kit: select (client)
  select: {
    placeholder: "اختر…",
  },

  // UI-kit: form-field (client) — localizes the native browser `required`
  // (valueMissing) validation message. Without it Base UI surfaces
  // `element.validationMessage`, localized to the BROWSER language, not the UI locale.
  field: {
    required: "يرجى ملء هذا الحقل",
    invalid: "يرجى إدخال قيمة صحيحة",
  },

  // UI-kit: clampable-content (client)
  clampable: {
    expand: "إظهار النص كاملاً",
    collapse: "عرض أقل",
  },

  // permission/status-banner
  statusBanner: {
    suspended: "حسابك مقيّد مؤقتًا. القراءة متاحة، أمّا الإجراءات الجديدة فلا.",
  },

  // canvas-render
  canvasRender: {
    emptyGraph: "الرسم البياني فارغ.",
    graphAriaLabel: "الرسم البياني للوحة",
  },

  // revision-history
  revisionHistory: {
    title: "سجل المراجعات",
    empty: "لا توجد مراجعات بعد.",
  },

  // attachments
  attachments: {
    title: "المرفقات",
    empty: "لا يوجد أي مرفق بعد.",
    operationError: "فشلت العملية",
    attach: "إرفاق",
    canvasNoPreview: "(لوحة — المعاينة غير متاحة)",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    detach: "إزالة الإرفاق",
    search: "بحث…",
  },
};

export default common;
