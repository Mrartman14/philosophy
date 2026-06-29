// src/i18n/messages/ar/errors.ts
// Зеркало ru/errors.ts (арабские литералы). Паритет ключей форсит satisfies Messages.
const errors = {
  // --- api-error: backend codes (DEFAULT_MESSAGES) ---
  REF_NOT_FOUND: "يشير أحد المراجع إلى كائن غير موجود.",
  BLOCKS_HAVE_ANCHORS:
    "لا يمكن حذف كتلة مرتبطة بتعليقات. احذف التعليقات أو أبقِ الكتلة.",
  VERSION_MISMATCH:
    "تم تغيير الكائن في مكان آخر. حدّث الصفحة وأعد المحاولة.",
  IF_MATCH_REQUIRED:
    "تعذّر تحديد إصدار الكائن. حدّث الصفحة وأعد المحاولة.",
  IDEMPOTENCY_KEY_IN_USE:
    "تتم معالجة الطلب بالفعل. يُرجى الانتظار وعدم إعادة الإرسال.",
  IDEMPOTENCY_KEY_REUSED:
    "يتعارض الطلب المُعدَّل مع طلب تم إرساله بالفعل. حدّث الصفحة.",
  IDEMPOTENCY_KEY_INVALID:
    "تعذّرت إعادة إرسال الطلب بأمان. حدّث الصفحة وأعد المحاولة.",

  // --- comments slice: domain codes ---
  SELF_REACTION: "لا يمكنك التفاعل مع تعليقك الخاص.",
  AXIS_NOT_ALLOWED: "هذا التفاعل غير متاح لهذا النوع من التعليقات.",
  INVALID_INSIGHT_VALUE: "تفاعل «الإلهام» متاح فقط بقيمة موجبة.",
  COMMENT_DELETED: "تم حذف التعليق.",
  PARENT_NOT_AVAILABLE: "التعليق الأصل غير متاح.",
  PARENT_WRONG_LECTURE: "التعليق الأصل غير متاح.",
  // مرساة التعليق (الربط بمقطع). رموز 422 من الخادم، راجع
  // POST /api/lectures/{id}/comments. ANCHOR_BLOCK_NOT_FOUND شائع عند انحراف نص التحديد.
  ANCHOR_ENTITY_UNKNOWN: "نوع هدف غير معروف لمرساة التعليق.",
  ANCHOR_BLOCK_NOT_FOUND: "المقطع المحدد لم يعد متاحًا — حدّده من جديد.",
  ANCHOR_TARGET_NOT_FOUND: "تعذّر العثور على هدف مرساة التعليق.",
  ANCHOR_TARGET_WRONG_LECTURE: "هدف المرساة يعود إلى محاضرة أخرى.",
  INVALID_ROOT_TYPE: "لا يمكن استخدام هذا النوع من التعليقات كجذر.",
  INVALID_TYPE_FOR_PARENT:
    "هذا النوع من التعليقات غير مسموح كرد على العقدة المحددة.",
  MAX_DEPTH_EXCEEDED: "تم تجاوز الحد الأقصى لعمق السلسلة.",
  BLOCKS_EMPTY: "لا يمكن أن يكون التعليق فارغًا.",
  BLOCKS_INVALID: "نص التعليق يحتوي على تنسيق غير صالح.",
  BLOCK_ID_UNKNOWN: "خطأ في معرّفات الكتل. أعد تحميل المحرر.",
  DUPLICATE_BLOCK_ID: "خطأ في معرّفات الكتل. أعد تحميل المحرر.",
  COMMENT_REFERENCED:
    "تشير محتويات أخرى إلى هذا التعليق. احذف المراجع أولًا.",
  BLOCK_REFERENCED:
    "يشير مرجع خارجي إلى كتلة في هذا التعليق. احذفه أولًا.",
  // BLOCKS_HAVE_ANCHORS for comments differs from the default (document/glossary context):
  BLOCKS_HAVE_ANCHORS_COMMENT:
    "تعليقات أخرى مرتبطة بكتل هذا التعليق. افصلها أولًا.",

  // --- forms slice: domain codes ---
  FORM_PUBLISHED: "النموذج منشور — لا يمكن تغيير بنيته.",
  FORM_PUBLIC_IMMUTABLE: "لا يمكن إعادة النموذج العام إلى خاص.",
  MODE_CHANGE_FORBIDDEN: "لا يمكن تحويل الوضع «غير القابل للتغيير» إلى «قابل للتحرير».",
  FORM_IMMUTABLE_MODE:
    "لا يسمح هذا النموذج بتحرير الاستجابة أو حذفها — يمكن سحبها فقط.",
  RETRACT_NOT_APPLICABLE: "السحب متاح فقط في النماذج التي لا تسمح بتحرير الاستجابة.",
  ALREADY_SUBMITTED: "لقد أرسلت استجابة بالفعل على هذا النموذج.",
  ALREADY_RETRACTED: "تم سحب الاستجابة بالفعل.",
  INVALID_FORM_SCHEMA: "لم تجتز بنية النموذج التحقق.",
  INVALID_SUBMISSION: "فشل التحقق من الإجابات. يُرجى ملء جميع الحقول المطلوبة بشكل صحيح.",
  FORM_NOT_FOUND: "النموذج غير موجود.",
  SUBMISSION_NOT_FOUND: "الاستجابة غير موجودة.",
  FORM_BLOCKS_INVALID: "فشل التحقق من وصف النموذج.",

  // --- documents slice: domain codes ---
  DOCUMENT_PUBLIC_IMMUTABLE: "لا يمكن جعل المستند العام خاصًا.",
  DOCUMENT_REFERENCED:
    "تشير محتويات أخرى إلى هذا المستند. احذف المراجع وأعد المحاولة.",
  DOCUMENT_BLOCK_REFERENCED:
    "يشير مرجع خارجي إلى كتلة في هذا المستند. احذفه أو أبقِ الكتلة.",
  DOCUMENT_BLOCKS_HAVE_ANCHORS:
    "لا يمكن حذف كتلة مرتبطة بتعليقات. احذف التعليقات أولًا.",
  DOCUMENT_BLOCKS_EMPTY: "يجب أن يحتوي المستند على كتلة واحدة على الأقل.",
  DOCUMENT_BLOCKS_INVALID: "نص المستند يحتوي على تنسيق غير صالح.",
  DOCUMENT_BLOCK_ID_UNKNOWN: "خطأ في معرّفات الكتل. أعد تحميل المحرر.",
  DOCUMENT_DUPLICATE_BLOCK_ID: "خطأ في معرّفات الكتل. أعد تحميل المحرر.",
  DOCUMENT_IMAGE_UNKNOWN_KEY: "يحتوي المستند على صورة بمفتاح غير معروف.",

  // --- api-error: 413 — generic default (comment create, search/context, etc.) ---
  REQUEST_BODY_TOO_LARGE: "الطلب كبير جدًا. قلّل المحتوى وأعد المحاولة.",
  PAYLOAD_TOO_LARGE: "الطلب كبير جدًا. قلّل المحتوى وأعد المحاولة.",

  // --- canvas slice: domain codes ---
  PUBLIC_IMMUTABLE: "لا يمكن جعل اللوحة العامة خاصة.",
  CANVAS_VERSION_MISMATCH:
    "تم تغيير اللوحة في مكان آخر — حدّث الصفحة وأعد المحاولة.",
  CANVAS_PAYLOAD_TOO_LARGE: "بيانات الرسم البياني كبيرة جدًا (الحد 1 ميبي بايت).",
  CANVAS_VALIDATION_ERROR:
    "فشل التحقق من الرسم البياني (العقد/الحواف/مراجع الكيانات).",

  // --- banners slice: domain codes ---
  BANNER_INVALID_COLOR:
    "لون خلفية غير صالح: استخدم قيمة hex مثل #RGB أو #RRGGBB.",
  BANNER_INVALID_DATE:
    "تواريخ عرض غير صالحة: تحقق من التنسيق وترتيب البداية والنهاية.",
  BANNER_INVALID_EVENT: "لا توجد فعالية بهذا المعرّف.",
  BANNER_BLOCKS_INVALID: "نص اللافتة يحتوي على تنسيق غير صالح.",
  BANNER_BLOCK_REFERENCED:
    "تشير محتويات أخرى إلى كتلة في هذه اللافتة. احذف المراجع أو أبقِ الكتلة.",
  BANNER_NOT_DISMISSIBLE: "لا يمكن إخفاء هذه اللافتة.",

  // --- users slice: domain codes ---
  USER_NOT_FOUND: "المستخدم غير موجود.",

  // --- lectures slice: domain codes ---
  UPLOAD_NOT_FOUND: "الصورة المرفوعة غير موجودة. يُرجى المحاولة مرة أخرى.",
  ALREADY_ATTACHED: "هذا الكيان مرفق بالفعل بالمحاضرة.",
  INVALID_ENTITY_TYPE: "نوع كيان غير صالح.",
  // NOT_FOUND — generic backend code; not added to the global catalog to prevent
  // isErrorKey from treating it as a catalog key for all slices.
  // The lectures slice maps NOT_FOUND → LECTURE_NOT_FOUND in its ERRORS map.
  LECTURE_NOT_FOUND: "المحاضرة غير موجودة.",

  // --- events slice: domain codes ---
  INVALID_DATE:
    "تاريخ غير صالح: تحقق من التنسيق وترتيب تاريخي البداية والنهاية.",
  INVALID_RRULE: "تعذّر التعرّف على قاعدة التكرار. تحقق من إعدادات التكرار.",
  EVENT_BLOCKS_INVALID: "وصف الفعالية يحتوي على تنسيق غير صالح.",
  EVENT_BLOCK_REFERENCED:
    "تشير محتويات أخرى إلى كتلة في هذه الفعالية. احذف المراجع أو أبقِ الكتلة.",

  // --- trails slice: domain codes ---
  TRAIL_PUBLIC_IMMUTABLE: "لا يمكن جعل المسار العام خاصًا — يمكنك حذفه فقط.",
  TRAIL_DUPLICATE_DOCUMENT: "تمت إضافة مستند إلى المسار مرتين. أزل التكرار.",
  TRAIL_DOCUMENT_NOT_FOUND: "أحد المستندات غير موجود. حدّث القائمة وأعد المحاولة.",

  // --- media slice: domain codes ---
  MEDIA_PUBLIC_IMMUTABLE:
    "لا يمكن جعل الوسائط العامة خاصة. احذفها وارفعها من جديد.",
  MEDIA_NOT_FOUND: "الوسائط غير موجودة.",
  MEDIA_INVALID_FORMAT: "تنسيق غير مدعوم. فيديو: mp4/webm. صوت: mp3/m4a/ogg.",
  MEDIA_FILE_TOO_LARGE: "الملف كبير جدًا (الحد الأقصى 100 MB).",

  // --- share-links slice: domain codes ---
  SHARE_LINK_NOT_FOUND: "المورد غير موجود أو أنت لست مالكه.",
  RESOURCE_NOT_PRIVATE: "لا يمكن إنشاء رابط مشاركة إلا لمورد خاص.",

  // --- preferences slice: domain codes ---
  NOT_CONFIGURED: "إشعارات Push لم تُهيّأ بعد.",

  // --- tokens slice: domain codes ---
  TOKEN_LIMIT: "تم بلوغ حد الرموز. ألغِ الرموز غير المستخدمة وأعد المحاولة.",

  // --- tags slice: domain codes ---
  TAG_CONFLICT: "يوجد وسم بهذا الاسم بالفعل.",
  TAG_NOT_FOUND: "الكائن غير موجود — ربما تم حذفه بالفعل. حدّث الصفحة.",

  // --- glossary slice: domain codes ---
  GLOSSARY_BLOCKS_EMPTY: "لا يمكن أن يكون محتوى المصطلح فارغًا.",
  GLOSSARY_BLOCK_REFERENCED:
    "تشير محتويات أخرى إلى كتلة في هذا المصطلح. احذف المراجع أو أبقِ الكتلة.",

  // --- annotations slice: domain codes ---
  ANNOTATION_BLOCKS_EMPTY: "لا يمكن أن يكون محتوى التعليق التوضيحي فارغًا.",
  ANNOTATION_BLOCKS_INVALID: "نص التعليق التوضيحي يحتوي على تنسيق غير صالح.",
  ANNOTATION_ANCHOR_INVALID: "ربط (مرساة) التعليق التوضيحي غير صالح.",
  ANNOTATION_INVALID_PARENT_TYPE: "التعليقات التوضيحية غير متاحة لهذا النوع من الكيانات.",
  ANNOTATION_REQUEST_BODY_TOO_LARGE: "التعليق التوضيحي كبير جدًا.",

  // --- api-error: rethrowApiError fallbacks ---
  serverError: "خطأ في الخادم",
  accountRestricted: "الحساب مقيّد.",

  // --- branded forbidden/suspended ---
  // {action} — the action phrase, e.g. "deleting the lecture".
  forbiddenAction: "ليست لديك صلاحية لـ {action}.",
  forbiddenGeneric: "ليست لديك صلاحية.",
  forbiddenTitle: "لا توجد صلاحية",
  failureTitle: "خطأ",
  unknown: "خطأ غير معروف",
};

export default errors;
