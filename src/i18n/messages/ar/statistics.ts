// src/i18n/messages/ar/statistics.ts
// Mirror of ru/statistics.ts (Arabic literals).
const statistics = {
  // --- entity type labels (view-stats, production-stats-table) ---
  entityType: {
    lecture: "المحاضرات",
    document: "المستندات",
    trail: "المسارات",
    canvas: "اللوحات",
    form: "النماذج",
    media: "الوسائط",
    annotation: "التعليقات التوضيحية",
    comment: "التعليقات",
  },

  // --- view-stats ---
  trackingDisabledTitle: "تتبع المشاهدات معطّل",
  trackingDisabledDescription:
    "فعّله في الإعدادات لرؤية إحصائيات مشاهداتك.",
  goToSettings: "الانتقال إلى الإعدادات",
  noViewsTitle: "لم تشاهد أي شيء بعد",
  noViewsDescription: "ستظهر الإحصائيات بعد مشاهداتك الأولى.",
  totalViews: "إجمالي المشاهدات:",
  untitled: "بلا عنوان",
  unavailable: "غير متاح",
  viewCount: "{count} مشاهدة",

  // --- production-stats-table ---
  noProductionTitle: "لم تنشئ أي شيء بعد",
  noProductionDescription:
    "ستظهر هنا إحصائيات محاضراتك ومستنداتك وموادك الأخرى.",
  colType: "النوع",
  colTotal: "الإجمالي",
  colPublic: "عامة",
  colPrivate: "خاصة",
  totalsRow: "الإجمالي",

  // --- history-tracking-toggle ---
  savedTitle: "تم الحفظ",
  trackingEnabledDescription: "تم تفعيل تتبع المشاهدات.",
  trackingDisabledAfterPurge: "تم تعطيل التتبع، وحُذف السجل.",
  trackingEnabledStatus: "تتبع المشاهدات مفعّل.",
  trackingDisabledStatus: "تتبع المشاهدات معطّل.",
  disableButton: "تعطيل",
  enableButton: "تفعيل",
  disableDialogTitle: "تعطيل التتبع؟",
  disableDialogDescription: "سيُحذف سجل المشاهدات بالكامل نهائيًا.",
  disableConfirmLabel: "حذف السجل",
  // Action phrase for "You don't have permission for {action}."
  manageSettingsAction: "تغيير الإعدادات",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadStatsFailed: "تعذّر تحميل الإحصائيات",
    loadViewStatsFailed: "تعذّر تحميل إحصائيات المشاهدات",
    loadHistorySettingsFailed: "تعذّر تحميل إعدادات السجل",
  },
};

export default statistics;
