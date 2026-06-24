// src/i18n/messages/ar/validation.ts
// مرآة لملف ru/validation.ts. تطابق المفاتيح يفرضه satisfies Messages.
const validation = {
  // --- reusable ---
  required: "حقل إلزامي",
  maxLen: "حتى {n} حرفًا",

  // --- shared messages used across multiple forms ---
  common: {
    // "Enter a title" — canvas/lectures/documents/trails/events/forms
    titleRequired: "أدخل العنوان",
    // "Body must be an array of blocks" — documents/banners/events/glossary
    blocksNotArray: "يجب أن يكون المحتوى مصفوفة من الكتل",
    // "Invalid date" — shareLinks/audit
    invalidDate: "تاريخ غير صالح",
  },

  // --- preferences: push.SendRequest ---
  pushSend: {
    titleRequired: "أدخل العنوان",
    titleMax: "حتى 200 حرف",
    bodyMax: "حتى 1000 حرف",
    urlFormat: 'يجب أن يبدأ الرابط بـ "/" أو "http(s)://"',
  },
  // --- preferences: push subscribe/unsubscribe ---
  pushSubscribe: {
    endpoint: "نقطة نهاية الاشتراك غير صالحة",
    p256dh: "مفتاح p256dh فارغ",
    auth: "مفتاح auth فارغ",
  },

  // --- auth: login ---
  login: {
    usernameRequired: "أدخل اسم المستخدم",
    usernameMax: "اسم المستخدم طويل جدًا",
    passwordRequired: "أدخل كلمة المرور",
    passwordMax: "كلمة المرور طويلة جدًا",
  },

  // --- auth: register ---
  register: {
    usernameMin: "يجب ألا يقل اسم المستخدم عن 3 أحرف",
    usernameMax: "يجب ألا يزيد اسم المستخدم عن 30 حرفًا",
    passwordMin: "يجب ألا تقل كلمة المرور عن 6 أحرف",
    passwordMax: "كلمة المرور طويلة جدًا",
    passwordConfirmMismatch: "كلمتا المرور غير متطابقتين",
  },

  // --- canvas: CanvasCreateSchema / CanvasUpdateSchema / CanvasIdSchema ---
  canvas: {
    titleMax: "حتى 200 حرف",
    invalidId: "معرّف اللوحة غير صالح",
    badJson: "JSON تالف في بيانات الرسم البياني",
    graphInvalid: "فشل الرسم البياني في التحقق",
    etagMissing: "إصدار اللوحة (ETag) مفقود — أعد تحميل الصفحة.",
    // CanvasDataSchema superRefine (node/edge structural errors)
    duplicateNodeId: "معرّف عقدة مكرر node.id \"{id}\"",
    edgeFromNotFound: "الحافة \"{edgeId}\": لم يُعثر على from_node \"{nodeId}\"",
    edgeToNotFound: "الحافة \"{edgeId}\": لم يُعثر على to_node \"{nodeId}\"",
  },

  // --- comments: createComment / updateCommentBlocks form schemas ---
  comments: {
    invalidType: "نوع تعليق غير معروف",
    invalidParentId: "معرّف parent_id غير صالح",
    invalidCommentId: "معرّف التعليق غير صالح",
    blocksInvalidJson: "JSON تالف في المحتوى",
    blocksNotArray: "لا يمكن أن يكون التعليق فارغًا",
    blocksEmpty: "لا يمكن أن يكون التعليق فارغًا",
  },

  // --- lectures: LectureCreateSchema / LectureUpdateSchema / etc. ---
  lectures: {
    titleMax: "حتى 200 حرف",
    descriptionMax: "حتى 5000 حرف",
    dateFormat: "يجب أن يكون التاريخ بصيغة YYYY-MM-DD",
    invalidId: "معرّف المحاضرة غير صالح",
    imageRequired: "لم يتم اختيار صورة",
    altMax: "حتى 500 حرف",
    entityRequired: "لم يتم اختيار كيان",
    blocksMin: "كتلة واحدة على الأقل مطلوبة",
  },

  // --- documents: DocumentCreateSchema / DocumentBlocksSchema / DocumentMetaSchema / etc. ---
  documents: {
    titleMax: "حتى 500 حرف",
    invalidId: "معرّف المستند غير صالح",
    blocksMinLength: "لا يمكن أن يكون محتوى المستند فارغًا",
    blocksInvalidJson: "JSON تالف في محتوى المستند",
    blocksEmpty: "أضف كتلة واحدة على الأقل",
  },

  // --- banners: BannerFieldsSchema / BannerUpdateSchema / BannerIdSchema ---
  banners: {
    colorFormat: "يجب أن يكون اللون قيمة سداسية مثل #RGB أو #RRGGBB",
    audienceRequired: "اختر الجمهور",
    dismissibleInvalid: 'قيمة غير صالحة لـ "يمكن إخفاؤه"',
    startAtRequired: "حدد وقت بدء العرض",
    startAtInvalid: "حدد تاريخًا ووقتًا صالحين لبدء العرض",
    endAtInvalid: "حدد تاريخًا ووقتًا صالحين لانتهاء العرض",
    endAtBeforeStart: "يجب أن يكون انتهاء العرض بعد بدايته",
    eventIdUuid: "يجب أن يكون معرّف الفعالية بصيغة UUID",
    blocksInvalidJson: "JSON تالف في محتوى النموذج",
    invalidId: "معرّف اللافتة غير صالح",
  },

  // --- trails: TrailCreateSchema / TrailMetaSchema / TrailItemsSchema / TrailIdSchema ---
  trails: {
    titleMax: "حتى 200 حرف",
    descriptionMax: "حتى 2000 حرف",
    invalidId: "معرّف المسار غير صالح",
    documentIdsRequired: "قائمة المستندات غير محددة",
    documentIdsBadJson: "JSON تالف في قائمة المستندات",
    documentIdsNotArray: "يجب أن تكون قائمة المستندات مصفوفة",
    documentItemNotString: "عنصر القائمة ليس سلسلة نصية",
    documentItemInvalidId: "معرّف المستند غير صالح",
    documentItemDuplicate: "تمت إضافة المستند مرتين",
  },

  // --- events: EventFieldsSchema / EventCreateSchema / EventUpdateSchema / EventIdSchema ---
  events: {
    titleMax: "حتى 500 حرف",
    startDateRequired: "أدخل تاريخ البدء",
    rruleMax: "حتى 500 حرف",
    dateFormat: "يجب أن تكون صيغة التاريخ YYYY-MM-DD",
    startDateTimeRequired: "أدخل تاريخ ووقت البدء",
    endDateTimeRequired: "أدخل تاريخ ووقت الانتهاء",
    endBeforeStart: "تاريخ الانتهاء قبل تاريخ البدء",
    rrulePrefix: "يجب أن يبدأ RRULE بـ FREQ=",
    blocksInvalidJson: "JSON تالف في محتوى النموذج",
    invalidId: "معرّف الفعالية غير صالح",
  },

  // --- annotations: AnnotationCreateSchema / AnnotationUpdateSchema ---
  annotations: {
    blocksMinLength: "لا يمكن أن يكون محتوى التعليق التوضيحي فارغًا",
    blocksInvalidJson: "JSON تالف في محتوى التعليق التوضيحي",
    blocksNotArray: "يجب أن يكون المحتوى مصفوفة غير فارغة من الكتل",
    blocksEmpty: "يجب أن يكون المحتوى مصفوفة غير فارغة من الكتل",
    anchorNotObject: "يجب أن يكون المرساة كائنًا",
    anchorInvalidJson: "JSON تالف في المرساة",
    invalidParentId: "معرّف الكيان الأصل غير صالح",
    invalidAnnotationId: "معرّف التعليق التوضيحي غير صالح",
    offsetMin: "offset >= 0",
  },

  // --- share-links: ExpiresAtSchema / ShareLinkCreateSchema / RevokeTokenSchema ---
  shareLinks: {
    resourceIdRequired: "أدخل معرّف المورد",
    tokenRequired: "الرمز مطلوب",
  },

  // --- users: UserRoleUpdateSchema / UserStatusUpdateSchema ---
  users: {
    invalidId: "معرّف المستخدم غير صالح",
  },

  // --- media: MediaIdSchema / MediaVisibilitySchema ---
  media: {
    invalidId: "معرّف الوسائط غير صالح",
  },

  // --- glossary: TermCreateSchema / TermBlocksUpdateSchema / TermIdSchema ---
  glossary: {
    titleRequired: "أدخل الاسم",
    titleMax: "حتى 300 حرف",
    invalidTermId: "معرّف المصطلح غير صالح",
    blocksInvalidJson: "تعذّرت معالجة متن المصطلح. حدّث الصفحة وحاول مرة أخرى.",
    blocksMinLength: "أضف وصفًا للمصطلح.",
    blocksEmpty: "أضف وصفًا للمصطلح.",
  },

  // --- tags: TagCreateSchema / TagUpdateSchema / TagIdSchema / SetLectureTagsSchema ---
  tags: {
    nameRequired: "أدخل اسم الوسم",
    nameMax: "حتى 100 حرف",
    invalidId: "معرّف الوسم غير صالح",
    invalidLectureId: "معرّف المحاضرة غير صالح",
    tagIdsEmpty: "حقل tag_ids فارغ",
    tagIdsInvalid: "يجب أن يكون tag_ids مصفوفة من معرّفات أعداد صحيحة موجبة",
    tagIdsBadJson: "JSON تالف في tag_ids",
  },

  // --- audit: log filters (AuditActorSchema / AuditActionSchema / AuditDateSchema) ---
  audit: {
    invalidActorUuid: "UUID الفاعل غير صالح",
    invalidActionFormat: "الصيغة: domain.verb",
  },

  // --- search: SearchQuerySchema ---
  search: {
    queryRequired: "أدخل استعلام البحث",
    queryMax: "حتى 200 حرف",
  },

  // --- tokens: CreateTokenSchema ---
  tokens: {
    labelRequired: "أدخل التسمية",
    labelMax: "حتى 100 حرف",
    expiresInt: "أدخل عدد أيام صحيحًا",
    expiresMin: "يوم واحد على الأقل",
    expiresMax: "حتى 90 يومًا",
  },

  // --- forms: form builder + response submission ---
  forms: {
    invalidId: "معرّف غير صالح",
    titleMax: "حتى 500 حرف",
    promptRequired: "نص السؤال مطلوب",
    emptyOption: "خيار فارغ",
    choiceRequiresOptions: "أضف خيارًا واحدًا على الأقل",
    optionsOnlyForChoice: "الخيارات مخصصة لحقول الاختيار فقط",
    duplicateOptions: "يجب ألا تتكرر الخيارات",
    fieldsRequired: "أضف حقلًا واحدًا على الأقل",
    duplicateSortOrder: "ترتيب الفرز مكرر للحقل رقم #{n}",
    emptyPayload: "نموذج فارغ",
    badJsonPayload: "JSON تالف في النموذج",
    payloadStructureError: "خطأ في بنية النموذج",
    visibilityRequired: "الظهور مطلوب",
    modeRequired: "الوضع مطلوب",
    emptyAnswers: "لا توجد إجابات",
    badJsonAnswers: "JSON تالف في الإجابات",
    answersNotArray: "يجب أن تكون الإجابات مصفوفة",
    invalidAnswer: "إجابة غير صالحة",
  },
};

export default validation;
