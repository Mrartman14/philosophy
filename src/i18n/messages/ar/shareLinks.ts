// src/i18n/messages/ar/shareLinks.ts
// Mirror of ru/shareLinks.ts (Arabic literals). Key parity is enforced by satisfies Messages.
const shareLinks = {
  // --- resource types ---
  resourceTypes: {
    lecture: "محاضرة",
    document: "مستند",
    trail: "مسار",
    media: "وسائط",
    form: "نموذج",
    canvas: "لوحة",
  },

  // --- copy-button ---
  copyDefault: "نسخ",
  copiedLabel: "تم النسخ ✓",
  copiedToast: "تم النسخ",
  copyFailTitle: "تعذّر النسخ",
  copyFailDesc: "حدّد الرابط وانسخه يدويًا.",

  // --- share-button ---
  shareButtonLabel: "مشاركة",
  shareDialogTitle: "مشاركة: {type}",
  shareDialogDesc: "يفتح الرابط المورد الخاص لحامله دون تسجيل الدخول.",
  expiresAtLabel: "تاريخ الانتهاء (اختياري)",
  createLinkButton: "إنشاء رابط",
  linkCreatedToast: "تم إنشاء الرابط",

  // --- share-link-list ---
  statusActive: "نشط",
  statusExpired: "منتهي الصلاحية",
  statusRevoked: "ملغى",
  emptyTitle: "لا توجد روابط",
  emptyDesc: "لم يصدر بعد أي رابط مشاركة لهذا المورد.",
  colStatus: "الحالة",
  colLink: "الرابط",
  colToken: "الرمز",
  colCreated: "تاريخ الإنشاء",
  colExpires: "تاريخ الانتهاء",
  colAction: "الإجراء",
  urlAriaLabel: "رابط المشاركة",
  revokeButton: "إلغاء",
  revokedToast: "تم إلغاء الرابط",

  // --- share-lookup-form ---
  resourceTypeLabel: "نوع المورد",
  resourceIdLabel: "معرّف المورد",
  resourceIdPlaceholder: "معرّف المورد",
  showLinksButton: "عرض الروابط",

  // --- toastActionError actions (phrase for errors.forbiddenAction) ---
  createLinkAction: "إنشاء الرابط",
  revokeLinkAction: "إلغاء الرابط",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadLinksFailed: "تعذّر تحميل روابط المشاركة",
  },
};

export default shareLinks;
