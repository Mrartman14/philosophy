// src/i18n/messages/ar/trails.ts
// Mirror of ru/trails.ts. Key parity is enforced by satisfies Messages.
const trails = {
  // --- trail-create-form ---
  createTitleLabel: "العنوان",
  createTitlePlaceholder: "عنوان المسار",
  createDescriptionLabel: "الوصف",
  createDescriptionPlaceholder: "وصف موجز (اختياري)",
  createVisibilityLabel: "مدى الظهور",
  createVisibilityPrivate: "خاص",
  createVisibilityPublic: "عام",
  createVisibilityNote: "لا يمكن إعادة المسار العام إلى خاص — يمكنك حذفه فقط.",
  createSubmit: "إنشاء",
  createForbiddenAction: "إنشاء المسار",

  // --- trail-meta-form ---
  metaTitleLabel: "العنوان",
  metaDescriptionLabel: "الوصف",
  metaSubmit: "حفظ",
  metaSaved: "تم الحفظ.",
  metaForbiddenAction: "تعديل المسار",

  // --- trail-delete-button ---
  deleteButton: "حذف",
  deleteDialogTitle: "حذف المسار؟",
  deleteDialogDescription: "هذا الإجراء لا رجعة فيه. لن يتم حذف المحاضرات الموجودة في المسار — المسار نفسه فقط.",
  deleteDialogConfirm: "حذف",
  deleteAction: "حذف المسار",
  deleteForbiddenTitle: "تعذّر الحذف",
  deleteFailureTitle: "تعذّر الحذف",

  // --- trail-items-editor ---
  itemsHeading: "محتويات المسار",
  itemsEmpty: "المسار فارغ. أضف مستندات.",
  itemsMoveUp: "تحريك لأعلى",
  itemsMoveDown: "تحريك لأسفل",
  itemsRemove: "إزالة",
  itemsPickerCancel: "إلغاء",
  itemsAddDocument: "+ إضافة مستند",
  itemsSaveSubmit: "حفظ المحتويات",
  itemsSavedTitle: "تم الحفظ",
  itemsSavedDescription: "تم تحديث محتويات المسار.",
  itemsErrorTitle: "خطأ",
  itemsAlreadyAddedTitle: "مُضاف بالفعل",
  itemsAlreadyAddedDescription: "هذا المستند موجود في المسار بالفعل.",
  itemsForbiddenAction: "تعديل المسار",
  itemsValidationError: "يرجى التحقق من قائمة المستندات.",

  // --- trail-visibility-button ---
  visibilityMakePublic: "جعله عامًا",
  visibilityForbiddenAction: "تغيير مدى الظهور",

  // --- trail-detail ---
  detailDocumentsHeading: "مستندات المسار",
  detailDocumentsEmpty: "لا توجد مستندات في هذا المسار بعد.",

  // --- trail-my-list ---
  myListEmpty: "ليس لديك أي مسارات بعد.",
  myListUntitled: "بلا عنوان",
  visibilityPrivate: "خاص",
  visibilityPublic: "عام",

  // --- trail-public-list ---
  publicListEmpty: "لا توجد مسارات بعد.",
  publicListUntitled: "بلا عنوان",

  // --- trail-admin-row ---
  adminUntitled: "بلا عنوان",
  adminAuthorLabel: "المؤلف",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "تعذّر تحميل المسارات",
    loadItemFailed: "تعذّر تحميل المسار",
  },
};

export default trails;
