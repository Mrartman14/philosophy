// src/i18n/messages/ar/forms.ts
// Mirror of ru/forms.ts. Key parity enforced by satisfies Messages.
const forms = {
  // --- field-kinds: field type labels ---
  fieldType: {
    text: "نص قصير",
    long_text: "نص طويل",
    single_choice: "اختيار واحد",
    multi_choice: "اختيار متعدد",
    number: "رقم",
    date: "تاريخ",
  },

  // --- form-meta: status labels ---
  visibility: {
    private: "خاصة",
    public: "عامة",
    // *Lower — lowercase variant for mid-sentence interpolation
    // (my-forms-list: "Visibility: {privateLower}"). Intentional convention.
    privateLower: "خاصة",
    publicLower: "عامة",
  },
  submissionMode: {
    editable: "يمكن تعديل الرد أو حذفه",
    immutable: "يمكن سحب الرد فقط",
    // *Lower — lowercase variant for mid-sentence interpolation
    // (my-forms-list: "Mode: {editableLower}"). Intentional convention.
    editableLower: "قابل للتعديل",
    immutableLower: "غير قابل للتغيير",
  },
  publishedBadge: "منشورة",
  publishedSuffix: " · منشورة",
  draftSuffix: " · مسودة",

  // --- form-detail: fallback title ---
  untitled: "نموذج",
  untitledForm: "بلا عنوان",

  // --- form-after-submit ---
  afterSubmitTitle: "بعد الإرسال",

  // --- form-builder ---
  builder: {
    titleLabel: "عنوان النموذج",
    descriptionLabel: "الوصف (markdown، اختياري)",
    afterSubmitLabel: "النص بعد الإرسال (markdown، اختياري)",
    visibilityLabel: "الظهور",
    visibilityPrivate: "خاصة",
    visibilityPublic: "عامة (النشر فورًا)",
    submissionModeLabel: "وضع الردود",
    submissionModeEditable: "قابل للتعديل (يمكن تغيير الردود أو حذفها)",
    submissionModeImmutable: "غير قابل للتغيير (يمكن سحب الردود فقط)",
    submissionModeHint:
      "لا يمكن تخفيف الوضع غير القابل للتغيير لاحقًا. ولا يمكن إعادة النموذج العام إلى خاص، كما لا يمكن تغيير بنيته.",
    addField: "+ إضافة حقل",
    submissionVisibilityLabel: "ظهور النتائج",
    submissionVisibilityPrivate: "خاصة (يراها المالك فقط)",
    submissionVisibilityPublic: "عامة (الأصوات المنسوبة مرئية لجمهور النموذج)",
    submissionVisibilityHint: "لا يمكن تغييره بعد الإنشاء.",
  },

  // --- form-results ---
  results: {
    totalSubmissions:
      "{n, plural, zero {# رد} one {# رد} two {ردّان} few {# ردود} many {# ردًا} other {# رد}}",
    answered:
      "{n, plural, zero {# أجاب} one {# أجاب} two {أجاب اثنان} few {# أجابوا} many {# أجابوا} other {# أجابوا}}",
    multiHint: "يُسمح باختيارات متعددة",
    min: "الأدنى",
    max: "الأقصى",
    avg: "المتوسط",
    sum: "المجموع",
    empty: "لا توجد ردود بعد",
    noTextAnswers: "لا توجد إجابات",
    allAnswers: "كل الإجابات →",
    forbidden: "نتائج هذا النموذج خاصة",
    titleSuffix: "النتائج",
    prevPage: "← السابق",
    nextPage: "التالي →",
    paginationLabel: "التنقل بين الإجابات",
    fieldType: {
      text: "نص",
      long_text: "نص",
      single_choice: "اختيار واحد",
      multi_choice: "اختيار متعدد",
      number: "رقم",
      date: "تاريخ",
    },
  },

  // --- form/result/mode badges ---
  badges: {
    form: { private: "النموذج: خاص", public: "النموذج: عام" },
    results: { private: "النتائج: خاصة", public: "النتائج: عامة" },
    mode: { editable: "الوضع: قابل للتعديل", immutable: "الوضع: ثابت" },
  },

  // --- form-fill: public vote consent ---
  publicVoteConsent:
    "هذا استطلاع عام: ستكون إجابتك مرئية لكل من يرى هذا النموذج، منسوبة إليك.",

  // --- form-builder-field-row ---
  fieldRow: {
    heading: "الحقل #{index}",
    ariaUp: "تحريك لأعلى",
    ariaDown: "تحريك لأسفل",
    ariaRemove: "إزالة",
    typeLabel: "نوع الحقل",
    promptLabel: "نص السؤال (markdown)",
    helpLabel: "تلميح (اختياري، markdown)",
    requiredLabel: "حقل مطلوب",
    optionsLabel: "الخيارات",
    optionPlaceholder: "الخيار {index}",
    ariaRemoveOption: "إزالة الخيار",
    addOption: "+ خيار",
  },

  // --- form-create-form / form-edit-form: buttons ---
  createSubmit: "إنشاء النموذج",
  editSubmit: "حفظ البنية",

  // --- form-delete-button / form-admin-row ---
  deleteFormLabel: "حذف النموذج",
  deleteFormTitle: "حذف النموذج؟",
  deleteFormDescriptionAdmin: "سيُحذف النموذج العام مع جميع ردوده. هذا الإجراء لا رجعة فيه.",
  deleteFormDescription: "هذا الإجراء لا رجعة فيه. ستُحذف جميع الردود على هذا النموذج.",
  deleteConfirm: "حذف",

  // --- form-publish-button ---
  publishButton: "نشر",
  publishTitle: "نشر النموذج؟",
  publishDescription:
    "بعد النشر، لا يمكن إعادة النموذج إلى خاص، ولا يمكن تغيير بنيته. وستتوقف روابط المشاركة الفعّالة عن العمل.",
  publishConfirm: "نشر",

  // --- form-fill ---
  submitSuccessMessage: "تم إرسال الرد. شكرًا لك!",
  requiredFieldsTitle: "املأ الحقول المطلوبة",
  requiredFieldsDescription: "لم تُملأ جميع الحقول المطلوبة.",
  submitButton: "إرسال الرد",
  submittingButton: "جارٍ الإرسال…",

  // --- submission-actions ---
  deleteSubmissionButton: "حذف الرد",
  retractSubmissionButton: "سحب الرد",
  deleteSubmissionTitle: "حذف الرد؟",
  retractSubmissionTitle: "سحب الرد؟",
  deleteSubmissionDescription: "سيُحذف الرد. وسيمكنك ملء النموذج من جديد.",
  retractSubmissionDescription: "السحب لا رجعة فيه: لن تتمكن من إرسال رد على هذا النموذج مرة أخرى.",
  deleteSubmissionConfirm: "حذف",
  retractSubmissionConfirm: "سحب",

  // --- submission-detail ---
  submissionRetracted: "تم سحب الرد — حُذفت الإجابات.",

  // --- submission-edit-form ---
  saveButton: "حفظ التغييرات",
  savingButton: "جارٍ الحفظ…",

  // --- my-forms-list ---
  noForms: "ليس لديك أي نماذج بعد.",

  // --- my-submissions-list ---
  noSubmissions: "ليس لديك أي ردود بعد.",
  submissionRetractedLabel: "مسحوب",
  formLinkPrefix: "النموذج {id}",

  // --- submission-list ---
  noSubmissionsAdmin: "لا توجد ردود بعد.",
  submissionLinkPrefix: "الرد {id}",

  // --- toastActionError actions (phrase for errors.forbiddenAction) ---
  fillAction: "إرسال الرد",
  submissionEditAction: "تعديل الرد",
  publishAction: "نشر النموذج",
  deleteFormAction: "حذف النموذج",
  deleteSubmissionAction: "حذف الرد",
  retractSubmissionAction: "سحب الرد",

  // --- toastActionError failureTitle overrides ---
  fillFailureTitle: "تعذّر الإرسال",
  submissionEditFailureTitle: "تعذّر الحفظ",

  // --- forbiddenAction per-feature phrases (for FormFeedback.forbiddenAction) ---
  editFormForbiddenAction: "تعديل النموذج",
  createFormForbiddenAction: "إنشاء النموذج",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadItemFailed: "تعذّر تحميل النموذج",
    loadMyFailed: "تعذّر تحميل النماذج",
    loadMySubmissionsFailed: "تعذّر تحميل الردود",
    loadSubmissionsFailed: "تعذّر تحميل الردود",
    loadSubmissionFailed: "تعذّر تحميل الرد",
    loadAdminFailed: "تعذّر تحميل النماذج",
    loadStatsFailed: "تعذّر تحميل إحصائيات النموذج",
    loadFieldAnswersFailed: "تعذّر تحميل إجابات الحقل",
  },
};

export default forms;
