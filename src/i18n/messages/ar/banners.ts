// src/i18n/messages/ar/banners.ts
// Mirror of ru/banners.ts. Key parity enforced by satisfies Messages.
const banners = {
  // --- Form field labels (create + edit) ---
  fieldVariant: "نوع اللافتة",
  variantInfo: "معلومة",
  variantSuccess: "نجاح",
  variantWarning: "تحذير",
  variantDanger: "حرج",
  variantBrand: "علامة تجارية",
  variantNeutral: "محايد",
  fieldAudience: "الجمهور",
  fieldAudienceAriaLabel: "الجمهور",
  fieldDismissible: "يمكن للمستخدم إخفاء اللافتة",
  fieldStartAt: "بداية العرض (منطقتك الزمنية)",
  fieldEndAt: "نهاية العرض (منطقتك الزمنية، اختياري)",
  fieldEventId: "معرّف الفعالية (اختياري)",
  fieldBlocks: "نص اللافتة",
  eventIdPlaceholder: "معرّف الفعالية (انظر الإدارة ← الفعاليات)",

  // --- Hints ---
  hintEndAt:
    "لا يمكن مسح «نهاية العرض» بعد حفظها — أبقِ القيمة الحالية أو أدخل قيمة جديدة.",
  hintEventId: "لإلغاء ربط الفعالية — امسح الحقل واحفظ.",

  // --- Buttons / submit ---
  createButton: "إنشاء",
  saveButton: "حفظ",
  deleteButton: "حذف",
  editButton: "تحرير",

  // --- Status ---
  saved: "تم الحفظ.",

  // --- Forbidden inline (Case 3: banner-edit-form only) ---
  editAction: "تحرير اللافتة",

  // --- Delete confirmation ---
  deleteTitle: "حذف اللافتة؟",
  deleteDescription: "هذا الإجراء لا رجعة فيه. ستختفي اللافتة من جميع الصفحات.",

  // --- Toast actions (for toastActionError) ---
  deleteAction: "حذف اللافتة",
  dismissAction: "إخفاء اللافتة",
  dismissFailTitle: "تعذّر إخفاء اللافتة",

  // --- Dismiss button ---
  dismissAriaLabel: "إخفاء اللافتة",

  // --- admin-row ---
  noText: "لافتة بدون نص",
  notDismissible: " · لا يمكن إخفاؤها",
  hasEvent: " · مرتبطة بفعالية",

  // --- active-banners aria ---
  sectionLabel: "الإعلانات",

  // --- Audience labels ---
  audienceAll: "للجميع",
  audienceAuthenticated: "للمستخدمين المسجَّلين",
  audienceAdmin: "للمشرفين",

  // --- Display period (formatBannerPeriod) ---
  periodFrom: "من {start}",
  periodFromTo: "من {start} إلى {end}",

  // --- create-form: forbiddenAction (Case 3) ---
  createAction: "إنشاء اللافتة",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "تعذّر تحميل اللافتات",
    loadItemFailed: "تعذّر تحميل اللافتة",
    loadRevisionsFailed: "تعذّر تحميل المراجعات",
    loadRevisionFailed: "تعذّر تحميل المراجعة",
  },
};

export default banners;
