// src/i18n/messages/ar/tags.ts
// Mirror of ru/tags.ts — English literals. Key parity enforced by satisfies Messages.
const tags = {
  // --- UI: tag-create-form ---
  newTagLabel: "وسم جديد",
  namePlaceholder: "مثال: «الأخلاق»",
  tagCreated: "تم إنشاء الوسم «{name}».",
  createButton: "إنشاء",
  createTagAction: "إنشاء وسم",

  // --- UI: tag-admin-row ---
  rename: "إعادة التسمية",
  cancel: "إلغاء",
  newNameLabel: "الاسم الجديد",
  saveButton: "حفظ",
  renameTagAction: "إعادة تسمية الوسم",

  // --- UI: tag-delete-button ---
  deleteButton: "حذف",
  deleteTitle: "حذف الوسم «{name}»؟",
  deleteDescription: "سيُزال الوسم من جميع المحاضرات. هذا الإجراء لا يمكن التراجع عنه.",
  deleteTagAction: "حذف الوسم",

  // --- UI: lecture-tags-form ---
  noTagsHint: "لا توجد وسوم بعد. أنشئها من صفحة «الوسوم» في لوحة المشرف.",
  saveTags: "حفظ الوسوم",
  tagsSaved: "تم حفظ الوسوم.",
  assignTagsAction: "تعيين الوسوم",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "تعذّر تحميل الوسوم",
    loadLectureTagsFailed: "تعذّر تحميل وسوم المحاضرة",
  },
};

export default tags;
