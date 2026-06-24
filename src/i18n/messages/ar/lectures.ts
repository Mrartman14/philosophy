// src/i18n/messages/ar/lectures.ts
// Mirror of ru/lectures.ts. Key parity enforced by satisfies Messages.
const lectures = {
  // --- UI-labels ---
  titleLabel: "العنوان",
  dateLabel: "التاريخ",
  dateDescription: "التنسيق YYYY-MM-DD",
  descriptionLabel: "الوصف",
  visibilityLabel: "الظهور",
  visibilityPrivate: "خاصة",
  visibilityPublic: "عامة",
  allTags: "كل الوسوم",

  // --- buttons / actions ---
  saveButton: "حفظ",
  createButton: "إنشاء",
  deleteButton: "حذف",
  editLink: "تحرير",
  searchButton: "بحث",
  searchPending: "…",
  replaceCover: "استبدال الغلاف",
  uploadCover: "رفع الغلاف",
  deleteCover: "حذف الغلاف",

  // --- cover form ---
  coverSectionLabel: "غلاف المحاضرة",
  coverHeading: "الغلاف",
  coverAlt: "غلاف المحاضرة",
  coverEmpty: "لم يُحدَّد غلاف.",
  coverAltLabel: "النص البديل (لإمكانية الوصول)",

  // --- delete dialog ---
  deleteDialogTitle: "حذف المحاضرة؟",
  deleteDialogDescription: "هذا الإجراء لا يمكن التراجع عنه.",

  // --- search form ---
  searchPlaceholder: "ابحث بالعنوان أو الوصف",
  searchAriaLabel: "البحث في المحاضرات",
  tagFilterAriaLabel: "تصفية حسب الوسم",

  // --- list empty state ---
  emptyTitle: "لم يُعثر على محاضرات",
  emptyDescription: "حاول تغيير عوامل التصفية أو استعلام البحث.",

  // --- edit form status ---
  savedMessage: "تم الحفظ.",

  // --- sections ---
  documentsSectionLabel: "مستندات المحاضرة",
  documentsSectionHeading: "مستندات المحاضرة",
  mediaSectionLabel: "وسائط المحاضرة",
  mediaSectionHeading: "وسائط المحاضرة",

  // --- attachments manager ---
  detachForbidden: "ليست لديك صلاحية إلغاء الإرفاق.",
  reorderForbidden: "ليست لديك صلاحية إعادة الترتيب.",
  attachForbidden: "ليست لديك صلاحية الإرفاق.",
  searchDocumentPlaceholder: "ابحث عن مستند…",
  searchMediaPlaceholder: "ابحث عن وسائط…",
  attachmentsEmpty: "لا شيء مُرفَق بعد.",

  // --- attach docs on create (Variant A) ---
  attachDocsLabel: "إرفاق مستندات",
  attachDocsHint: "اختياري. اختر مستندات موجودة — ستُرفق بالمحاضرة بعد إنشائها.",
  attachDocsRemove: "إزالة {label}",

  // --- forbidden actions (Case 3 — action phrase) ---
  coverForbiddenAction: "تغيير الغلاف",
  visibilityForbiddenAction: "تغيير الظهور",
  editForbiddenAction: "التحرير",
  createAction: "إنشاء محاضرة",
  deleteAction: "حذف المحاضرة",

  // --- server throws (api.ts fallback messages) ---
  api: {
    loadListFailed: "تعذّر تحميل المحاضرات",
    loadItemFailed: "تعذّر تحميل المحاضرة",
    loadDocumentsFailed: "تعذّر تحميل مستندات المحاضرة",
    loadMediaFailed: "تعذّر تحميل وسائط المحاضرة",
  },
};

export default lectures;
