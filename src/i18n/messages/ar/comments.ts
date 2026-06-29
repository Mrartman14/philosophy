// src/i18n/messages/ar/comments.ts
// Mirror of ru/comments.ts. Key parity enforced by satisfies Messages in en/index.ts.
const comments = {
  // --- comment-type-badge ---
  type: {
    claim: "أطروحة",
    grounds: "أساس",
    rebuttal: "اعتراض",
    qualifier: "توضيح",
    question: "سؤال",
    answer: "إجابة",
    offtop: "خارج الموضوع",
    summary: "خلاصة",
  },

  // --- comment-node-view ---
  deleted: "تم حذف التعليق",
  edited: "(معدَّل)",

  // --- comment-tree-view / comment-tree ---
  empty: "لا توجد تعليقات بعد.",

  // --- comment-section ---
  sectionLabel: "التعليقات",
  sectionHeading: "النقاش",
  loginPrompt: "سجّل الدخول لترك تعليق.",
  unavailable: "التعليقات غير متاحة مؤقتًا.",
  searchFoundCount: "تم العثور على: {count}",
  noSnippet: "(بدون نص)",

  // --- comment-anchor-context ---
  anchor: {
    boundTo: "مرتبط بـ{entity}",
    document: "المستند",
    glossary: "المصطلح",
    comment: "التعليق",
    media: "الوسائط",
  },

  // --- comment-search ---
  searchPlaceholder: "البحث في التعليقات…",
  searchAriaLabel: "البحث في تعليقات المحاضرة",
  searchButton: "بحث",
  searchPending: "…",

  // --- comment-create-form ---
  createTypeLabel: "نوع التعليق",
  createTypeAriaLabel: "نوع التعليق",
  createBodyLabel: "النص",
  createBodyAriaLabel: "نص التعليق",
  createSuccess: "تمت إضافة التعليق.",
  createSubmit: "إرسال",
  createForbiddenAction: "إنشاء تعليق",

  // --- comment-edit-form ---
  editButton: "تحرير",
  editBodyLabel: "النص",
  editBodyAriaLabel: "تحرير التعليق",
  editSuccess: "تم الحفظ.",
  editSubmit: "حفظ",
  editCancel: "إلغاء",
  editForbiddenAction: "تعديل تعليق",

  // --- comment-reply-form ---
  replyButton: "رد",
  replyTypeLabel: "نوع الرد",
  replyTypeAriaLabel: "نوع الرد",
  replyBodyLabel: "نص الرد",
  replyBodyAriaLabel: "نص الرد",
  replySubmit: "رد",
  replyCancel: "إلغاء",
  replyForbiddenAction: "الرد",

  // --- comment-delete-button ---
  deleteButton: "حذف",
  deleteDone: "تم الحذف",
  deleteDialogTitle: "حذف التعليق؟",
  deleteDialogDescription:
    "هذا الإجراء لا يمكن التراجع عنه. إذا كان للتعليق ردود، فسيصبح «محذوفًا» لكن سلسلة الردود ستبقى.",
  deleteDialogConfirm: "حذف",
  deleteForbiddenTitle: "تعذّر الحذف",
  deleteFailureTitle: "تعذّر الحذف",
  deleteAction: "حذف تعليق",

  // --- comment-reactions ---
  reactionForbidden: "ليست لديك صلاحية للتفاعل.",

  // --- lazy-ast-editor ---
  editorLoading: "جارٍ تحميل المحرّر…",

  // --- admin-comment-row ---
  adminDeleted: "محذوف",

  // --- margin comments (selection marginalia UI) ---
  marginCommentAdd: "تعليق",
  marginComposerTitle: "تعليق على المقطع المحدد",
  marginOpenThread: "فتح المناقشة",
  marginColumnLabel: "تعليقات على المقاطع المحددة",
  marginOrphanLabel: "لم يتم العثور على المقطع",

  // --- reactions.ts axis labels (catalog only — isomorphic boundary) ---
  axis: {
    agreement: "الموافقة",
    quality: "الجودة",
    insight: "البصيرة",
  },
  axisValueAria: {
    agreementPos: "موافق",
    agreementNeg: "غير موافق",
    qualityPos: "جودة عالية",
    qualityNeg: "جودة منخفضة",
    insightMark: "وضع علامة كبصيرة",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadSchemaFailed: "تعذّر تحميل محرر التعليقات",
    loadListFailed: "تعذّر تحميل التعليقات",
    loadSubtreeFailed: "تعذّر تحميل سلسلة الردود",
    searchFailed: "تعذّر تنفيذ البحث",
    loadRevisionsFailed: "تعذّر تحميل المراجعات",
    loadRevisionFailed: "تعذّر تحميل المراجعة",
    loadBlockFailed: "تعذّر تحميل الكتلة",
  },
};

export default comments;
