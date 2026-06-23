// src/i18n/messages/ar/editor.ts
// UI strings for the AST editor component (mirror of ru/editor.ts).
const editor = {
  // --- Editor (use-ast-editor) ---
  editorAriaLabel: "محرر AST",

  // --- Schema context (schema-context) ---
  schemaUnavailable: "مخطط AST غير متاح: {message}",

  // --- Image node view (image-node-view) ---
  imageLoading: "جارٍ تحميل الصورة",

  // --- Toolbar: inline marks (inline-marks) ---
  bold: "عريض",
  italic: "مائل",
  code: "رمز",

  // --- Toolbar: block buttons (block-buttons) ---
  blockquote: "اقتباس",
  codeBlock: "كتلة رمز",
  thematicBreak: "خط أفقي",
  table: "جدول",

  // --- Toolbar: list buttons (list-buttons) ---
  bulletList: "قائمة نقطية",
  orderedList: "قائمة مرقمة",
  checkList: "قائمة مهام",

  // --- Toolbar: heading select (heading-select) ---
  blockTypeAriaLabel: "نوع الكتلة",
  paragraph: "فقرة",
  heading1: "عنوان 1",
  heading2: "عنوان 2",
  heading3: "عنوان 3",
  heading4: "عنوان 4",
  heading5: "عنوان 5",
  heading6: "عنوان 6",

  // --- Toolbar: link popover (link-popover) ---
  linkAriaLabel: "رابط",
  linkUrlAriaLabel: "عنوان URL للرابط",
  linkInvalidScheme: "مخطط رابط غير صالح (المسموح به: http، https، mailto)",
  linkRemove: "إزالة الرابط",
  linkApply: "تطبيق",

  // --- Toolbar: ref popover (ref-popover) ---
  insertRefAriaLabel: "إدراج مرجع كيان",

  // --- Toolbar: image button (image-button) ---
  imageAriaLabel: "صورة",
  imageUploadFailTitle: "تعذّر رفع الصورة",
  imageUploadFailGeneric: "حدث خطأ. يرجى المحاولة مرة أخرى.",
  imageUploadForbidden: "ليست لديك صلاحية رفع الصور.",
  imageUploadTooLarge: "الصورة كبيرة جدًا (الحد الأقصى 10 MiB)",
  imageUploadInvalidMime: "تنسيق ملف غير مدعوم",
  imageUploadNetworkError: "خطأ في الشبكة",
  imageUploadNoAccess: "تم رفض الوصول",
  imageUploadFailed: "خطأ في الرفع: {status}",

  // --- Toolbar: slash menu (slash-menu) ---
  slashMenuAriaLabel: "أوامر الكتلة",
  slashMenuNoMatches: "لا توجد نتائج مطابقة",
  slashMenuClose: "Esc — إغلاق",
  slashMenuHeading: "عنوان {level}",
  slashMenuBlockquote: "اقتباس",
  slashMenuCodeBlock: "كتلة رمز",
  slashMenuBulletList: "قائمة نقطية",
  slashMenuOrderedList: "قائمة مرقمة",
  slashMenuThematicBreak: "فاصل",
  slashMenuTable: "جدول 3×3",

  // --- Ref menu (ref-menu) ---
  insertRefDialogAriaLabel: "إدراج مرجع",
  refCategoryGlossary: "مصطلح",
  refCategoryDocument: "مستند",
  refCategoryMedia: "وسائط",
  refCategoryComment: "تعليق",

  // --- Async combobox (async-combobox) ---
  comboboxEmpty: "لم يُعثر على شيء",
  comboboxError: "خطأ في التحميل",
  comboboxLoading: "جارٍ التحميل…",
  comboboxRetry: "إعادة المحاولة",
  comboboxLoadMore: "تحميل المزيد",

  // --- Pickers: placeholders ---
  lecturePlaceholder: "البحث عن محاضرة…",
  glossaryPlaceholder: "البحث عن مصطلح…",
  documentPlaceholder: "البحث عن مستند…",
  mediaPlaceholder: "البحث عن وسائط…",
  canvasPlaceholder: "البحث عن لوحة…",
  commentPlaceholder: "البحث عن تعليق في المحاضرة المحددة…",

  // --- Media picker (media-picker) ---
  mediaTypeLabel: "النوع",
  mediaTypeAll: "الكل",
  mediaTypeVideo: "فيديو",
  mediaTypeAudio: "صوت",

  // --- Comment 2-stage picker (comment-2stage-picker) ---
  commentPickerStep1: "الخطوة 1: اختر محاضرة",
  commentPickerStep2: "الخطوة 2: اختر تعليقًا",
  commentPickerChangeLecture: "تغيير المحاضرة",

  // --- Schema server (schema-server) ---
  schemaLoadError: "تعذّر تحميل مخطط محرر AST",
};

export default editor;
