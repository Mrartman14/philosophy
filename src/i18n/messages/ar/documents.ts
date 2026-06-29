// src/i18n/messages/ar/documents.ts
// Mirror of ru/documents.ts. Key parity enforced by satisfies Messages.
const documents = {
  // --- UI-labels (shared) ---
  titleLabel: "العنوان",
  contentLabel: "المحتوى",
  visibilityLabel: "الظهور",
  visibilityPrivate: "خاص",
  visibilityPublic: "عام",
  titlePlaceholder: "عنوان المستند",
  fileLabel: "ملف Markdown ‏(.md)",
  noTitle: "بلا عنوان",

  // --- visibility warning ---
  publicWarning:
    "لا يمكن إعادة المستند العام إلى خاص — يمكن حذفه فقط.",

  // --- buttons ---
  createButton: "إنشاء",
  saveContentButton: "حفظ المحتوى",
  saveTitleButton: "حفظ العنوان",
  uploadButton: "رفع",
  makePublicButton: "جعله عامًا",
  deleteButton: "حذف",

  // --- saved/status ---
  savedMessage: "تم الحفظ.",

  // --- empty states ---
  emptyDocument: "المستند فارغ.",
  emptyMyList: "ليس لديك أي مستندات بعد.",

  // --- admin row ---
  authorLabel: "المؤلف",

  // --- containers panel ---
  containersPanelTitle: "مُضمَّن في محاضرات",
  containersEmpty: "هذا المستند غير مُضمَّن في أي محاضرة.",
  containerLinkLabel: "محاضرة {id}",

  // --- delete dialog ---
  deleteDialogTitle: "حذف المستند؟",
  deleteDialogDescription:
    "هذا الإجراء لا رجعة فيه. إذا كان هناك محتوى يشير إلى المستند، فسيُرفض الحذف.",
  deleteDialogConfirm: "حذف",

  // --- forbidden actions (Case 3: action phrase for errors.forbiddenAction) ---
  editForbiddenAction: "تعديل المستند",
  visibilityForbiddenAction: "تغيير الظهور",
  createAction: "إنشاء مستند",
  uploadAction: "رفع مستند",
  deleteAction: "حذف المستند",

  // --- conflict merge (AstMergeView) ---
  merge: {
    title: "تم تغيير المستند في مكان آخر",
    intro:
      "بينما كنت تحرر، قام مستخدم آخر بحفظ هذا المستند. ادمج التغييرات كتلةً كتلة.",
    badgeServerChanged: "تم التغيير في النسخة المحفوظة",
    badgeYourEdit: "تعديلك",
    badgeAddedByYou: "أُضيف بواسطتك",
    badgeAddedOnServer: "أُضيف في النسخة المحفوظة",
    badgeRemovedByYou: "حُذف بواسطتك",
    badgeRemovedOnServer: "حُذف في النسخة المحفوظة",
    conflictHeading: "تعارض — اختر نسخة الكتلة",
    optionServer: "النسخة المحفوظة",
    optionMine: "نسختك",
    acceptDeletion: "قبول الحذف",
    contentChanged: "تغيّر المحتوى",
    unchangedLabel: "كتل دون تغيير",
    showUnchanged: "إظهار الكتل دون تغيير",
    hideUnchanged: "إخفاء الكتل دون تغيير",
    applyButton: "تطبيق ومتابعة",
    cancelButton: "إلغاء",
    takeServerButton: "تجاهل تعديلاتي وأخذ النسخة المحفوظة",
    goneMessage:
      "تم حذف المستند في مكان آخر. انسخ تعديلاتك وأعد تحميل الصفحة.",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadMyFailed: "تعذّر تحميل المستندات",
    loadItemFailed: "تعذّر تحميل المستند",
    loadContainersFailed: "تعذّر تحميل المرفقات",
    loadRevisionsFailed: "تعذّر تحميل المراجعات",
    loadRevisionFailed: "تعذّر تحميل المراجعة",
    loadAdminFailed: "تعذّر تحميل المستندات",
  },
};

export default documents;
