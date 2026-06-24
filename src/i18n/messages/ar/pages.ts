// src/i18n/messages/ar/pages.ts
// English translations for public pages (src/app/** excluding admin/).
const pages = {
  // ─── Global errors / not-found / offline ─────────────────────────────
  errorTitle: "حدث خطأ ما",
  errorBody: "حدث خطأ أثناء تحميل الصفحة.",
  errorRetry: "حاول مرة أخرى",
  errorCritical: "حدث خطأ حرج. حاول تحديث الصفحة.",
  errorCriticalRetry: "إعادة المحاولة",
  notFoundTitle: "الصفحة غير موجودة",
  notFoundHome: "الانتقال إلى الرئيسية",
  offlineTitle: "لا يوجد اتصال بالإنترنت",
  offlineHint: "تحقق من اتصالك بالإنترنت وحاول مرة أخرى.",

  // ─── Home page ────────────────────────────────────────────────────────
  homeTitle: "مدخل إلى الفلسفة",
  homeComingSoon: "يجري إعداد المحتوى. عُد لاحقًا.",

  // ─── Auth (login / register) ──────────────────────────────────────────
  loginTitle: "تسجيل الدخول",
  loginHeading: "تسجيل الدخول",
  loginBanned: "تم حظر حسابك. يرجى التواصل مع الدعم.",
  loginRegistered: "تم التسجيل بنجاح. سجّل الدخول باسم المستخدم وكلمة المرور الخاصين بك.",
  loginNoAccount: "ليس لديك حساب؟",
  loginRegisterLink: "أنشئ حسابًا",
  registerTitle: "إنشاء حساب",
  registerHeading: "إنشاء حساب",
  registerHasAccount: "لديك حساب بالفعل؟",
  registerLoginLink: "سجّل الدخول",

  // ─── /me ─────────────────────────────────────────────────────────────
  meTitle: "حسابي",
  meHint: "اختر قسمًا من الأعلى.",

  // ─── /me nav sections ────────────────────────────────────────────────
  meNavNotifications: "الإشعارات",
  meNavDocuments: "مستنداتي",
  meNavMedia: "وسائطي",
  meNavAnnotations: "تعليقاتي التوضيحية",
  meNavForms: "نماذجي",
  meNavSubmissions: "ردودي",
  meNavStats: "إحصائياتي",
  meNavSettings: "الإعدادات",
  meNavTokens: "رموز الوصول",
  meNavAriaLabel: "التنقل في الحساب",

  // ─── /me/notifications ───────────────────────────────────────────────
  notificationsTitle: "الإشعارات",
  notificationsHeading: "الإشعارات",
  notificationsEmpty: "لا توجد إشعارات بعد.",

  // ─── /me/documents ───────────────────────────────────────────────────
  myDocumentsTitle: "مستنداتي",
  myDocumentsHeading: "مستنداتي",
  myDocumentsTotal: "الإجمالي: {total}",
  myDocumentsCreate: "إنشاء مستند",
  myDocumentsUpload: "رفع ملف ‎.md",

  // ─── /documents/new ──────────────────────────────────────────────────
  createDocumentTitle: "إنشاء مستند",
  createDocumentHeading: "إنشاء مستند",
  createDocumentBack: "العودة إلى مستنداتي",
  createDocumentEditorSection: "الكتابة في المحرر",

  // ─── /me/media ───────────────────────────────────────────────────────
  myMediaTitle: "وسائطي",
  myMediaHeading: "وسائطي",
  myMediaUploadSection: "رفع",

  // ─── /me/annotations ─────────────────────────────────────────────────
  myAnnotationsTitle: "تعليقاتي التوضيحية",
  myAnnotationsHeading: "تعليقاتي التوضيحية",
  myAnnotationsEmpty: "ليس لديك تعليقات توضيحية بعد.",

  // ─── /me/forms ───────────────────────────────────────────────────────
  myFormsTitle: "نماذجي",
  myFormsHeading: "نماذجي",
  myFormsCreate: "إنشاء نموذج",

  // ─── /forms/new ──────────────────────────────────────────────────────
  createFormTitle: "إنشاء نموذج",
  createFormHeading: "إنشاء نموذج",
  createFormBack: "العودة إلى نماذجي",

  // ─── /me/submissions ─────────────────────────────────────────────────
  mySubmissionsTitle: "ردودي",
  mySubmissionsHeading: "ردودي",

  // ─── /me/stats ───────────────────────────────────────────────────────
  myStatsTitle: "إحصائياتي",
  myStatsHeading: "إحصائياتي",
  myStatsCreated: "ما أنشأته",
  myStatsViews: "مشاهداتي",

  // ─── /lectures ───────────────────────────────────────────────────────
  lecturesTitle: "المحاضرات",
  lecturesHeading: "المحاضرات",
  lecturesLoadingLabel: "جارٍ تحميل المحاضرات…",

  // ─── /lectures/[id] ──────────────────────────────────────────────────
  lectureDefaultTitle: "محاضرة",

  // ─── /lectures/[id]/annotations ──────────────────────────────────────
  lectureAnnotationsTitle: "التعليقات التوضيحية للمحاضرة",
  lectureAnnotationsHeading: "التعليقات التوضيحية للمحاضرة",
  lectureAnnotationsEmpty: "لا توجد تعليقات توضيحية لهذه المحاضرة بعد.",

  // ─── /glossary ───────────────────────────────────────────────────────
  glossaryTitle: "المسرد",
  glossaryHeading: "المسرد",
  glossaryLoadingLabel: "جارٍ تحميل المسرد…",

  // ─── /glossary/[id] ──────────────────────────────────────────────────
  termDefaultTitle: "مصطلح",

  // ─── /calendar ───────────────────────────────────────────────────────
  calendarTitle: "التقويم",
  calendarHeading: "التقويم",

  // ─── /search ─────────────────────────────────────────────────────────
  searchTitle: "بحث",
  searchHeading: "بحث",
  searchSubtitle: "بحث دلالي في المستندات ومصطلحات المسرد.",
  searchPlaceholder: "أدخل استعلامًا لبدء البحث.",
  searchUnavailable: "البحث غير متاح مؤقتًا. حاول لاحقًا.",

  // ─── /map ────────────────────────────────────────────────────────────
  mapTitle: "خريطة المعاني",
  mapLink: "العرض على الخريطة",

  // ─── /graph ──────────────────────────────────────────────────────────
  graphTitle: "رسم بياني للمراجع",

  // ─── /me/tokens ──────────────────────────────────────────────────────
  tokensTitle: "الرموز الشخصية",
  tokensHeading: "رموز الوصول الشخصية",
  tokensSubtitle:
    "رموز للوصول إلى الواجهة البرمجية نيابةً عنك — مثلًا لربط خدمة خارجية بنموذج LLM الخاص بها.",

  // ─── /share-links ────────────────────────────────────────────────────
  shareLinksTitle: "روابطي",
  shareLinksHeading: "روابطي",
  shareLinksSubtitle: "إدارة روابط المشاركة. اختر نوع المورد وأدخل معرّفه لرؤية الروابط الصادرة.",
  shareLinksHint: "حدّد نوع المورد ومعرّفه في الأعلى.",

  // ─── /canvases ───────────────────────────────────────────────────────
  canvasesTitle: "اللوحات",
  canvasesHeading: "اللوحات",
  canvasesTotal: "الإجمالي: {total}",
  canvasesCreate: "إنشاء لوحة",

  // ─── /canvases/new ───────────────────────────────────────────────────
  canvasNewTitle: "لوحة جديدة",
  canvasNewHeading: "لوحة جديدة",

  // ─── /canvases/[id] ──────────────────────────────────────────────────
  canvasDefaultTitle: "لوحة",
  canvasEditSection: "تحرير",
  canvasOpenEditor: "فتح المحرّر",

  // ─── /canvases/[id]/edit ─────────────────────────────────────────────
  canvasEditorTitle: "محرّر اللوحة",
  canvasEditorHeading: "محرّر اللوحة {title}",

  // ─── /documents ──────────────────────────────────────────────────────
  documentsLoadingLabel: "جارٍ تحميل المستندات…",

  // ─── /documents/[id] ─────────────────────────────────────────────────
  documentDefaultTitle: "مستند",
  documentEdit: "تحرير",
  documentMarginHint: "تظهر الملاحظات الهامشية هنا على الشاشات العريضة.",
  documentToc: "في هذه الصفحة",

  // ─── /documents/[id]/edit ────────────────────────────────────────────
  documentEditHeading: "تحرير",
  documentEditBack: "العودة إلى المستند",
  documentEditMetaTitleFull: "تحرير: {filename}",
  documentEditMetaTitleFallback: "تحرير المستند",

  // ─── /trails ─────────────────────────────────────────────────────────
  trailsTitle: "المسارات",
  trailsHeading: "المسارات",
  trailsSubtitle: "مجموعات محاضرات منسّقة. الإجمالي: {total}",
  trailsLoadingLabel: "جارٍ تحميل المسارات…",

  // ─── /trails/my ──────────────────────────────────────────────────────
  myTrailsTitle: "مساراتي",
  myTrailsHeading: "مساراتي",
  myTrailsTotal: "الإجمالي: {total}",
  myTrailsCreate: "إنشاء مسار",

  // ─── /trails/[id] ────────────────────────────────────────────────────
  trailDefaultTitle: "مسار",
  trailEditSection: "تحرير",

  // ─── /forms/[id] ─────────────────────────────────────────────────────
  formDefaultTitle: "نموذج",
  formSubmissionsLink: "الردود",
  formFillSection: "تعبئة",
  formEditSection: "تحرير البنية",
  formEditHint: "متاح فقط قبل النشر. تُجمّد البنية بعد النشر.",
  formPublishedNote: "النموذج منشور — لا يمكن تغيير بنيته.",

  // ─── /forms/[id]/submissions ─────────────────────────────────────────
  formSubmissionsTitle: "ردود النموذج",
  formSubmissionsHeading: "الردود: {formTitle}",
  formSubmissionsTotal: "الإجمالي: {total}",

  // ─── /comments/[id] ──────────────────────────────────────────────────
  commentTitle: "تعليق",
  commentThreadHeading: "سلسلة النقاش",

  // ─── /media/[id] ─────────────────────────────────────────────────────
  mediaDefaultTitle: "وسائط",

  // ─── /submissions/[id] ───────────────────────────────────────────────
  submissionTitle: "رد",
  submissionRetracted: "تم سحب الرد",
  submissionSent: "أُرسل في {date}",
  submissionYourResponse: "ردك",
  submissionContents: "محتوى الرد",

  // ─── /saved ──────────────────────────────────────────────────────────
  savedTitle: "المحفوظات دون اتصال",
  savedListHeading: "المحفوظات دون اتصال",
  savedListEmpty: "لم يُحفظ شيء بعد. افتح محاضرة وانقر «الحفظ دون اتصال».",

  // ─── /saved/[id] (SavedLectureView) ──────────────────────────────────
  savedLectureMissing: "هذه المحاضرة غير محفوظة دون اتصال.",
  savedLectureSaving: "ما زالت المحاضرة قيد الحفظ…",
  savedLectureIncomplete: "لم يكتمل الحفظ: {error}.",
  savedLectureCorrupt: "النسخة المحفوظة تالفة أو قديمة — افتح المحاضرة عبر الإنترنت واحفظها من جديد.",
  savedLectureGone: "تمت إزالة هذه المحاضرة من المنصة. لا تزال لديك نسخة محفوظة.",
  savedLectureStale: "تتوفر نسخة محدّثة — انقر «تحديث».",
  savedLectureSavedAt: "محفوظة دون اتصال:",
  savedLectureRefreshing: "جارٍ التحديث…",
  savedLectureRefresh: "تحديث",
  savedLectureRefreshError: "تعذّر التحديث — تحقق من اتصالك.",
  savedLectureComments: "التعليقات",
  savedLectureSavedBadge: "محفوظة دون اتصال ✓",

  // ─── _offline/save-offline-button ────────────────────────────────────
  saveOfflineSaving: "جارٍ الحفظ…",
  saveOfflineButton: "الحفظ دون اتصال",
  saveOfflineSuccessTitle: "تم الحفظ للاستخدام دون اتصال",
  saveOfflineFailTitle: "تعذّر الحفظ دون اتصال",
  saveOfflineUpdateAvailable: "يتوفر تحديث",
  saveOfflineUpdate: "تحديث",
  saveOfflineUpdating: "جارٍ التحديث…",
  saveOfflineRemove: "إزالة النسخة",
  saveOfflineRemoving: "جارٍ الإزالة…",
  saveOfflineRemoveConfirmTitle: "إزالة النسخة المحفوظة دون اتصال؟",
  saveOfflineRemoveConfirmBody:
    "ستُحذف النسخة من هذا الجهاز. يمكنك استعادتها عبر الإنترنت فقط بحفظ المحاضرة من جديد.",
  saveOfflineRemoveConfirmAction: "إزالة",
  saveOfflineRemovedToast: "تمت إزالة النسخة المحفوظة دون اتصال",
  saveOfflineRemoveFailTitle: "تعذّر إزالة النسخة",

  // ─── saved-list stale sweep ──────────────────────────────────────────
  savedListStaleSaving: "انقطع الحفظ — افتح المحاضرة واحفظها من جديد.",
};

export default pages;
