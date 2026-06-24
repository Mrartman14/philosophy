// src/i18n/messages/ar/admin.ts
// English translations for admin pages (src/app/admin/**), including the
// frozen shell (layout.tsx, admin-sidebar.tsx). Machine-generated; requires
// native-speaker review.
const admin = {
  // --- shell (layout.tsx + admin-sidebar.tsx) ---
  shellTitle: "لوحة الإدارة",
  shellBackToSite: "إلى الموقع",
  shellNavAriaLabel: "تنقل لوحة الإدارة",

  // --- nav items (admin-sidebar.tsx; key comes from NavItem.labelKey) ---
  nav: {
    lectures: "المحاضرات",
    glossary: "المسرد",
    tags: "الوسوم",
    events: "الفعاليات",
    banners: "اللافتات",
    documents: "المستندات",
    forms: "النماذج",
    trails: "المسارات",
    shareLinks: "الروابط",
    comments: "التعليقات",
    annotations: "التعليقات التوضيحية",
    media: "الوسائط",
    users: "المستخدمون",
    push: "إشعارات Push",
    audit: "التدقيق",
  },

  // --- страница /admin (dashboard) ---
  dashboardTitle: "لوحة الإدارة",
  dashboardSubtitle: "أدِر الأقسام عبر القائمة على اليسار.",

  // --- forbidden-страница (403) ---
  forbiddenTitle: "403",
  forbiddenDescription: "الوصول إلى لوحة الإدارة ممنوع.",

  // --- лекции ---
  lecturesTitle: "المحاضرات",
  lecturesCreate: "إنشاء",
  lecturesEmptyTitle: "لا توجد محاضرات بعد",
  lecturesEmptyDescription: "أنشئ أول محاضرة.",
  lecturesColTitle: "العنوان",
  lecturesColDate: "التاريخ",
  lecturesColVisibility: "الظهور",
  lecturesColActions: "الإجراءات",

  // --- новая лекция ---
  newLectureTitle: "محاضرة جديدة",

  // --- редактирование лекции ---
  editLectureTagsHeading: "الوسوم",
  editLectureAttachmentsHeading: "المرفقات",
  editLectureAttachmentsLink: "إدارة مستندات ووسائط المحاضرة",

  // --- прикрепления лекции ---
  attachmentsPageTitle: "{lectureTitle}: المرفقات",
  attachmentsDocumentFallback: "مستند",
  attachmentsDocsSectionTitle: "مستندات المحاضرة",
  attachmentsMediaSectionTitle: "وسائط المحاضرة",

  // --- комментарии ---
  commentsTitle: "إشراف التعليقات",
  commentsLectureIdLabel: "معرّف المحاضرة",
  commentsLectureIdPlaceholder: "UUID المحاضرة",
  commentsShowButton: "عرض",
  commentsNoLectureHint: "أدخل معرّف المحاضرة — لا توجد قائمة تعليقات شاملة في الواجهة الخلفية.",
  commentsTotal: "الإجمالي: {total}",
  commentsEmpty: "لا توجد تعليقات.",

  // --- аннотации ---
  annotationsTitle: "التعليقات التوضيحية (العامة)",
  annotationsDescription: "تظهر التعليقات التوضيحية العامة فقط. الحذف متاح للتعليقات التوضيحية العامة (التعليقات الخاصة لا يمكن الإشراف عليها).",
  annotationsEmpty: "لم يُعثر على شيء.",

  // --- media (moderation) ---
  mediaTitle: "إشراف الوسائط",
  mediaDescription: "الوسائط غير الخاصة لجميع المستخدمين. الحذف لا رجعة فيه.",
  mediaEmpty: "لم يُعثر على شيء.",
  mediaTotal: "الإجمالي: {total}",
  mediaOwnerLabel: "المؤلف",
  mediaFilterOwnerLabel: "معرّف المؤلف",
  mediaFilterApply: "عرض",
  mediaFilterClear: "إعادة تعيين",

  // --- пользователи ---
  usersTitle: "المستخدمون",
  usersTotal: "الإجمالي: {total}",

  // --- теги ---
  tagsTitle: "الوسوم",
  tagsTotal: "الإجمالي: {total}",
  tagsEmptyTitle: "لا توجد وسوم بعد",
  tagsEmptyDescription: "أنشئ أول وسم باستخدام النموذج أعلاه.",

  // --- маршруты ---
  trailsTitle: "المسارات",
  trailsTotal: "المسارات العامة. الإجمالي: {total}",

  // --- события ---
  eventsTitle: "الفعاليات",
  eventsTotal: "الإجمالي: {total}",

  // --- баннеры ---
  bannersTitle: "اللافتات",
  bannersTotal: "الإجمالي: {total}",
  bannerFallbackTitle: "لافتة",

  // --- глоссарий ---
  glossaryTitle: "المسرد",
  glossaryTotal: "الإجمالي: {total}",
  glossaryEditHint: "لا يمكن تغيير عنوان المصطلح. يمكن تحرير المحتوى فقط.",

  // --- документы ---
  documentsTitle: "المستندات",
  documentsTotal: "المستندات العامة. الإجمالي: {total}",

  // --- формы ---
  formsTitle: "النماذج",
  formsTotal: "النماذج العامة. الإجمالي: {total}",

  // --- share-ссылки ---
  shareLinksTitle: "إشراف الروابط",
  shareLinksDescription: "عرض وإلغاء أي روابط مشاركة. حدّد نوع المورد ومعرّفه.",
  shareLinksHint: "حدّد نوع المورد ومعرّفه أعلاه.",

  // --- push ---
  pushTitle: "إشعارات Push",
  pushDescription: "يُرسَل البث إلى جميع المستخدمين المشتركين. الإرسال غير متزامن — يستغرق التسليم وقتًا.",

  // --- SEO meta: page <title> ---
  dashboardMetaTitle: "لوحة الإدارة",
  trailsMetaTitle: "المسارات — الإدارة",
  commentsMetaTitle: "إشراف التعليقات",
  formsMetaTitle: "النماذج — الإدارة",
  shareLinksMetaTitle: "إشراف الروابط — الإدارة",
  bannersMetaTitle: "اللافتات — الإدارة",
  bannerEditMetaTitle: "اللافتات — تحرير",
  tagsMetaTitle: "الوسوم — الإدارة",
  annotationsMetaTitle: "التعليقات التوضيحية — الإشراف",
  mediaMetaTitle: "الوسائط — الإشراف",
  pushMetaTitle: "إشعارات Push — الإدارة",
  auditMetaTitle: "التدقيق — الإدارة",
  usersMetaTitle: "المستخدمون — الإدارة",
  glossaryMetaTitle: "المسرد — الإدارة",
  glossaryEditMetaTitle: "المسرد — تحرير المصطلح",
  glossaryNewMetaTitle: "المسرد — مصطلح جديد",
  glossaryNewHeading: "إنشاء مصطلح",
  glossaryNewBack: "العودة إلى المصطلحات",
  glossaryCreateLink: "إنشاء مصطلح",
  documentsMetaTitle: "المستندات — الإدارة",
  lecturesMetaTitle: "المحاضرات — الإدارة",
  newLectureMetaTitle: "محاضرة جديدة",
  editLectureMetaTitle: "تحرير المحاضرة",
  attachmentsMetaTitle: "مرفقات المحاضرة",
  eventsMetaTitle: "الفعاليات — الإدارة",
  eventEditMetaTitle: "الفعاليات — تحرير",
};

export default admin;
