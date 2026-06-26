// src/i18n/messages/ar/canvas.ts
// Mirror of ru/canvas.ts (Arabic literals). Key parity enforced by satisfies Messages.
import type { Messages } from "../ru";

const canvas: Messages["canvas"] = {
  // --- canvas-create-form ---
  createForm: {
    titleLabel: "العنوان",
    visibilityLabel: "الظهور",
    dataLabel: "بيانات الرسم البياني (JSON، اختياري)",
    // ICU: escape the braces with single quotes, otherwise {"nodes"…} is parsed
    // by next-intl as a (malformed) placeholder → the key itself is rendered.
    dataDescription: "مثال: '{\"nodes\":[],\"edges\":[]}'",
    visibilityPrivate: "خاص",
    visibilityPublic: "عام",
    submitCreate: "إنشاء",
    toastCreatedTitle: "تم إنشاء اللوحة",
    toastErrorTitle: "خطأ",
  },

  // --- canvas-edit-form ---
  editForm: {
    titleLabel: "العنوان",
    dataLabel: "بيانات الرسم البياني (JSON)",
    submitSave: "حفظ",
    toastSavedTitle: "تم الحفظ",
    toastErrorTitle: "خطأ",
  },

  // --- canvas-delete-button ---
  deleteButton: {
    trigger: "حذف",
    title: "حذف اللوحة؟",
    description: "هذا الإجراء لا يمكن التراجع عنه.",
    confirmLabel: "حذف",
    toastDeletedTitle: "تم حذف اللوحة",
  },

  // --- canvas-visibility-button ---
  visibilityButton: {
    makePublic: "جعلها عامة",
    toastPublishedTitle: "تم نشر اللوحة",
    toastErrorTitle: "خطأ",
  },

  // --- canvas-editor ---
  editor: {
    ariaLabel: "محرر اللوحة",
    toastValidationTitle: "فشل التحقق من الرسم البياني",
    toastValidationFallback: "صحّح الأخطاء.",
    toastSavedTitle: "تم الحفظ",
    toastSaveErrorTitle: "خطأ في الحفظ",
    toastCopiedTitle: "تم النسخ إلى الحافظة",
    toastCopyErrorTitle: "تعذّر النسخ",
    confirmLeave: "توجد تغييرات غير محفوظة. المغادرة دون حفظ؟",
    titleRequired: "أدخل عنوانًا.",
  },

  // --- editor-toolbar ---
  toolbar: {
    back: "رجوع",
    addText: "نص",
    addRect: "مستطيل",
    addEllipse: "بيضاوي",
    addDiamond: "معيّن",
    addLink: "رابط",
    deleteSelected: "حذف",
    undoAriaLabel: "تراجع",
    redoAriaLabel: "إعادة",
    reset: "إرجاع",
    toolSelect: "تحديد",
    toolHand: "يد",
    fit: "ملاءمة المحتوى",
    grid: "المساطر",
    showCanvas: "اللوحة",
    showJson: "JSON",
    export: "تنزيل",
    exportSvg: "تنزيل SVG",
    exportPng: "تنزيل PNG",
    exportJson: "تنزيل JSON",
    copyJson: "نسخ كـ JSON",
    unsavedChanges: "توجد تغييرات غير محفوظة",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    create: "إنشاء",
  },

  // --- editor context menu (right-click) ---
  contextMenu: {
    center: "توسيط في العرض",
    bringToFront: "إحضار إلى الأمام",
    sendToBack: "إرسال إلى الخلف",
    delete: "حذف",
  },

  // --- editor-inspector ---
  inspector: {
    emptyHint: "اختر عقدة أو حافة.",
    nodeHeading: "عقدة: {type}",
    shapeLabel: "الشكل",
    shapeAriaLabel: "الشكل",
    shapeRect: "مستطيل",
    shapeEllipse: "بيضاوي",
    shapeDiamond: "معيّن",
    xLabel: "X",
    yLabel: "Y",
    widthLabel: "العرض",
    heightLabel: "الارتفاع",
    edgeHeading: "حافة",
    edgeCaptionLabel: "تسمية",
    edgeStyleLabel: "النمط",
    edgeStyleAriaLabel: "النمط",
    edgeStyleSolid: "متصل",
    edgeStyleDashed: "متقطع",
    edgeEndLabel: "النهاية",
    edgeEndAriaLabel: "النهاية",
    edgeEndArrow: "سهم",
    edgeEndNone: "بلا سهم",
    edgeFromSideLabel: "من الجهة",
    edgeFromSideAriaLabel: "من الجهة",
    edgeToSideLabel: "إلى الجهة",
    edgeToSideAriaLabel: "إلى الجهة",
    sideAuto: "تلقائي",
    sideTop: "أعلى",
    sideRight: "يمين",
    sideBottom: "أسفل",
    sideLeft: "يسار",
  },

  // --- entity-ref-dialog ---
  entityRefDialog: {
    title: "إضافة مرجع إلى كيان",
    typeLabel: "نوع الكيان",
    typeAriaLabel: "نوع الكيان",
    idLabel: "معرّف الكيان (UUID)",
    addButton: "إضافة",
    typeDocument: "مستند",
    typeGlossary: "مسرد",
    typeMedia: "وسائط",
    typeCanvas: "لوحة",
    typeComment: "تعليق",
    typeAnnotation: "تعليق توضيحي",
    typeForm: "نموذج",
    typeBanner: "لافتة",
    typeEvent: "فعالية",
  },

  // --- entity-ref labels (resolveEntityRefView; entity-reference node chip) ---
  // 9 entity_ref types + fallback for an unknown type.
  entityType: {
    document: "مستند",
    media: "وسائط",
    comment: "تعليق",
    glossary: "مسرد",
    form: "نموذج",
    canvas: "لوحة",
    annotation: "تعليق توضيحي",
    banner: "لافتة",
    event: "فعالية",
    fallback: "كائن",
  },

  // --- canvas-my-list ---
  myList: {
    empty: "لا توجد لوحات بعد.",
    untitled: "بلا عنوان",
    visibilityPublic: "عام",
    visibilityPrivate: "خاص",
  },

  // --- canvas-containers ---
  containers: {
    title: "مُضمَّن في المحاضرات",
    emptyText: "اللوحة غير مُضمَّنة في أي محاضرة.",
    lectureLabel: "محاضرة {id}",
  },

  // --- canvas-revisions ---
  revisions: {
    versionLabel: "الإصدار {num}",
  },

  // --- canvas-search ---
  search: {
    placeholder: "البحث بالعنوان",
    submit: "بحث",
  },

  // --- editor/validate.ts (graph structural validation; keys + ICU params) ---
  validate: {
    tooManyNodes: "عدد العقد كبير جدًا: {count} > {max}",
    tooManyEdges: "عدد الحواف كبير جدًا: {count} > {max}",
    nodeNoId: "العقدة بلا معرّف",
    duplicateNodeId: 'معرّف عقدة مكرّر "{id}"',
    nodeSizePositive: 'العقدة "{id}": يجب أن تكون الأبعاد موجبة',
    textNodeNoText: 'عقدة النص "{id}" بلا نص',
    nodeTextTooLong: 'العقدة "{id}": النص طويل جدًا',
    shapeNoKind: 'الشكل "{id}" بلا نوع شكل',
    entityRefNoType: 'المرجع "{id}" بلا نوع كيان',
    entityRefNoId: 'المرجع "{id}" بلا معرّف كيان',
    nodeUnknownType: 'العقدة "{id}": نوع غير معروف',
    edgeNoId: "الحافة بلا معرّف",
    edgeFromNotFound: 'الحافة "{id}": from_node غير موجود',
    edgeToNotFound: 'الحافة "{id}": to_node غير موجود',
    edgeLabelTooLong: 'الحافة "{id}": التسمية طويلة جدًا',
  },

  // --- forbidden actions ---
  createForbiddenAction: "إنشاء لوحة",
  updateForbiddenAction: "تعديل اللوحة",
  editorUpdateForbiddenAction: "تعديل اللوحة",
  deleteForbiddenAction: "حذف اللوحة",
  visibilityForbiddenAction: "تغيير ظهور اللوحة",

  // --- api.ts: fetch error messages (thrown to React error boundary) ---
  api: {
    loadCanvasesFailed: "تعذّر تحميل اللوحات",
    loadCanvasFailed: "تعذّر تحميل اللوحة",
    loadRevisionsFailed: "تعذّر تحميل المراجعات",
    loadRevisionFailed: "تعذّر تحميل المراجعة",
    loadContainersFailed: "تعذّر تحميل الارتباطات",
  },
};

export default canvas;
