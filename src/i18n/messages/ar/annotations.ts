// src/i18n/messages/ar/annotations.ts
// Mirror of ru/annotations.ts. Key parity enforced by satisfies Messages in en/index.ts.
const annotations = {
  // --- annotation-card ---
  visibility: {
    private: "خاص",
    public: "عام",
    unknown: "خاص",
  },
  edited: " · مُعدَّل",

  // --- annotation-list ---
  empty: "لا توجد تعليقات توضيحية بعد.",

  // --- annotation-create-form ---
  createBodyLabel: "نص التعليق التوضيحي",
  createBodyAriaLabel: "نص التعليق التوضيحي",
  createSubmit: "إضافة تعليق توضيحي",
  createForbiddenAction: "إنشاء تعليق توضيحي",

  // --- annotation-edit-form ---
  editBodyLabel: "نص التعليق التوضيحي",
  editBodyAriaLabel: "نص التعليق التوضيحي",
  editSuccess: "تم الحفظ.",
  editForbiddenAction: "تعديل تعليق توضيحي",
  editSubmit: "حفظ",

  // --- annotation-edit-button ---
  editButton: "تعديل",
  editDialogTitle: "تعديل التعليق التوضيحي",
  editorLoading: "جارٍ تحميل المحرر…",

  // --- annotation-delete-button ---
  deleteButton: "حذف",
  deleteDialogTitle: "حذف التعليق التوضيحي؟",
  deleteDialogDescription: "هذا الإجراء لا يمكن التراجع عنه.",
  deleteDialogConfirm: "حذف",
  deleteAction: "حذف تعليق توضيحي",

  // --- annotation-visibility-field ---
  visibilityLegend: "الظهور",
  visibilityPrivateLabel: "خاص (مرئي لي فقط)",
  visibilityPublicLabel: "عام (مرئي لكل من يمكنه رؤية هذا الكيان)",
  visibilityImmutableNote: "لا يمكن تغيير الظهور بعد الإنشاء.",

  // --- annotation-admin-filter-form ---
  filterEntityTypeLabel: "نوع الكيان:",
  filterEntityTypeAll: "الكل",

  // --- annotations-section ---
  sectionLabel: "التعليقات التوضيحية",
  sectionHeading: "التعليقات التوضيحية",

  // --- annotation-admin-row ---
  adminAuthorLabel: "المؤلف",

  // --- actions.ts: internal error when annotation not found ---
  notFound: "لم يُعثر على التعليق التوضيحي.",

  // --- marginalia engine (composer / connector) ---
  marginAddButton: "تعليق",
  marginAddUnanchored: "إضافة تعليق",
  marginComposerTitle: "تعليق جديد",
  marginOrphanLabel: "لم يتم العثور على المقطع",
  marginHighlightToggleOn: "إخفاء التظليل",
  marginHighlightToggleOff: "إظهار التظليل",
  marginColumnLabel: "تعليقات الهامش",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "تعذّر تحميل التعليقات التوضيحية",
    loadListFailedStatus: "تعذّر تحميل التعليقات التوضيحية ({status})",
    loadItemFailed: "تعذّر تحميل التعليق التوضيحي",
    loadMyFailed: "تعذّر تحميل تعليقاتي التوضيحية",
    loadLectureFailed: "تعذّر تحميل التعليقات التوضيحية للمحاضرة",
    loadAdminFailed: "تعذّر تحميل قائمة التعليقات التوضيحية",
    loadRevisionsFailed: "تعذّر تحميل المراجعات",
    loadRevisionFailed: "تعذّر تحميل المراجعة",
  },
};

export default annotations;
