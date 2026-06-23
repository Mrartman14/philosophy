// src/i18n/messages/ar/glossary.ts
// Mirror of ru/glossary.ts (Arabic literals). Key parity enforced by satisfies Messages.
const glossary = {
  // --- glossary-admin-row ---
  editButton: "تحرير",

  // --- glossary-create-form ---
  titleLabel: "الاسم",
  titlePlaceholder: "على سبيل المثال: «نظرية المعرفة»",
  createButton: "إنشاء",
  createTermAction: "إنشاء مصطلح",

  // --- glossary-delete-button ---
  deleteButton: "حذف",
  deleteConfirmTitle: "حذف المصطلح؟",
  deleteConfirmDescription:
    "هذا الإجراء لا يمكن التراجع عنه. إذا كانت مواد أخرى تشير إلى كتل هذا المصطلح، فسيُرفض الحذف.",
  deleteConfirmLabel: "حذف",
  deleteTermAction: "حذف مصطلح",

  // --- glossary-detail ---
  updatedAt: "تم التحديث: {date}",

  // --- glossary-edit-form ---
  blocksLabel: "متن المصطلح",
  savedMessage: "تم الحفظ.",
  saveButton: "حفظ",
  updateTermAction: "تعديل المصطلح",

  // --- glossary-export-links ---
  exportLabel: "تصدير:",

  // --- glossary-list ---
  emptyState: "لم يُعثر على أي مصطلحات.",
  totalCount: "الإجمالي: {count}",

  // --- glossary-revisions ---
  revisionsTitle: "سجل مراجعات المصطلح",

  // --- glossary-search-form ---
  searchPlaceholder: "البحث بالاسم",
  searchButton: "بحث",
  searchPending: "…",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "تعذّر تحميل المصطلحات",
    loadItemFailed: "تعذّر تحميل المصطلح",
    loadRevisionsFailed: "تعذّر تحميل مراجعات المصطلح",
    loadRevisionFailed: "تعذّر تحميل مراجعة المصطلح",
  },
};

export default glossary;
