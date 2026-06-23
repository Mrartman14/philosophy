// src/i18n/messages/ar/tokens.ts
const tokens = {
  // --- Create form (tokens-manager.tsx) ---
  labelField: "الاسم",
  labelPlaceholder: "مثلًا، Claude Desktop",
  expiresField: "المدة",
  expiresNever: "بلا انتهاء",
  expires7: "7 أيام",
  expires30: "30 يومًا",
  expires90: "90 يومًا",
  createButton: "إنشاء رمز",
  createHint:
    "يمنح الرمز وصولًا إلى الـ API نيابةً عنك — مثلًا، لربط خدمة خارجية بنموذجها اللغوي الخاص.",
  limitsHint:
    "الاسم مطلوب. أقصى مدة هي 90 يومًا (أو بلا انتهاء). يُعرض السر مرة واحدة فقط.",
  createAction: "إنشاء رمز",

  // --- One-time secret reveal ---
  revealTitle: "تم إنشاء الرمز",
  revealWarning: "انسخه الآن — لن يُعرض مرة أخرى.",
  revealAriaLabel: "الرمز الخام",
  revealDismiss: "تم",
  createdNoSecretTitle: "تم إنشاء الرمز",
  createdNoSecretDesc: "لم يُسترجع أي سر — حدّث القائمة وتحقق من الرمز.",

  // --- Connect (connect-instructions.tsx) ---
  connectTitle: "كيفية الربط",
  connectIntro:
    "أنشئ رمزًا أعلاه، ثم أضف philosophy كموصّل MCP في عميل النموذج اللغوي لديك (Claude أو Cursor أو ChatGPT) والصق الرمز.",
  connectUrlLabel: "عنوان خادم MCP",
  connectCliLabel: "Claude Code (الطرفية)",
  connectDesktopHint:
    "Claude Desktop / claude.ai: الإعدادات → Connectors → أضف موصّلًا مخصصًا بهذا العنوان، ويوضع الرمز في الاستيثاق (Bearer).",

  // --- List (token-list.tsx) ---
  colStatus: "الحالة",
  colLabel: "الاسم",
  colHint: "التلميح",
  colCreated: "تاريخ الإنشاء",
  colExpires: "تاريخ الانتهاء",
  colAction: "الإجراء",
  statusActive: "نشط",
  statusRevoked: "ملغًى",
  statusExpired: "منتهٍ",
  neverExpires: "بلا انتهاء",
  revokeButton: "إلغاء",
  revokeAction: "إلغاء الرمز",
  revokedToast: "تم إلغاء الرمز",
  confirmRevokeTitle: "إلغاء الرمز؟",
  confirmRevokeDesc:
    "سيفقد أي عميل يستخدم هذا الرمز الوصول فورًا. لا يمكن التراجع عن هذا الإجراء.",
  emptyTitle: "لا توجد رموز بعد",
  emptyDesc: "أنشئ رمزًا لربط خدمة خارجية.",

  // --- Copy (copy-button.tsx) ---
  copyLabel: "نسخ",
  copiedLabel: "تم النسخ",
  copiedToast: "تم النسخ",
  copyFailTitle: "فشل النسخ",
  copyFailDesc: "انسخه يدويًا.",

  // --- Usage tracking (usage-tracking-toggle.tsx) ---
  usageTrackingHeading: "تتبّع الاستخدام",
  usageTrackingIntro:
    "عند التفعيل، يسجّل كل رمز عدد الطلبات ووقت آخر استخدام.",
  usageTrackingEnabledStatus: "التتبّع مفعّل.",
  usageTrackingDisabledStatus: "التتبّع معطّل.",
  usageTrackingEnableButton: "تفعيل التتبّع",
  usageTrackingDisableButton: "تعطيل التتبّع",
  usageTrackingDisableDialogTitle: "تعطيل تتبّع الاستخدام؟",
  usageTrackingDisableDialogDescription:
    "ستُحذف جميع العدّادات المتراكمة (عدد الطلبات ووقت آخر استخدام) نهائيًا.",
  usageTrackingDisableConfirmLabel: "تعطيل وحذف",
  usageTrackingSavedTitle: "تم الحفظ",
  usageTrackingEnabledToast: "تم تفعيل تتبّع الاستخدام.",
  usageTrackingDisabledToast: "تم تعطيل التتبّع، وحُذفت العدّادات.",
  usageTrackingManageAction: "تغيير إعدادات التتبّع",
  // token table columns
  colLastUsed: "آخر استخدام",
  colRequests: "الطلبات",

  // --- API errors (api.ts) ---
  api: {
    loadFailed: "فشل تحميل الرموز",
  },
};

export default tokens;
