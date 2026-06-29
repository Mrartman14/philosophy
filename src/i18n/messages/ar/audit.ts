// src/i18n/messages/ar/audit.ts
// English translations for the audit (admin log) slice.
const audit = {
  // --- audit-filter-form: field labels and buttons ---
  filterAllTypes: "جميع الأنواع",
  filterActorLabel: "معرّف المستخدم",
  filterTargetTypeLabel: "نوع الكائن",
  filterTargetIdLabel: "معرّف الكائن",
  filterTargetIdPlaceholder: "معرّف الكائن",
  filterActionLabel: "الإجراء",
  filterAllActions: "جميع الإجراءات",
  filterFromLabel: "من",
  filterToLabel: "إلى",
  filterSubmit: "تصفية",
  filterReset: "إعادة تعيين",

  // --- admin audit page ---
  pageTitle: "التدقيق",
  pageDescription: "سجل إجراءات المشرف. إجمالي السجلات: {total}",

  // --- audit-table: column headers and empty state ---
  colTime: "الوقت",
  colActor: "المستخدم",
  colAction: "الإجراء",
  colTarget: "الكائن",
  colDetails: "التفاصيل",
  detailsToggle: "عرض",
  emptyTitle: "لم يتم العثور على سجلات",
  emptyDescription: "حاول تخفيف عوامل التصفية أو توسيع النطاق الزمني.",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadLogFailed: "تعذّر تحميل سجل التدقيق",
  },
};

export default audit;
