// src/i18n/messages/ar/auth.ts
// Mirror of ru/auth.ts (Arabic literals). Key parity enforced by satisfies Messages.
const auth = {
  // --- login-form ---
  login: {
    usernameLabel: "اسم المستخدم",
    passwordLabel: "كلمة المرور",
    submit: "تسجيل الدخول",
    fallbackError: "تعذّر تسجيل الدخول.",
    // AuthError codes (backend → UI)
    errors: {
      invalid_credentials: "اسم المستخدم أو كلمة المرور غير صحيحة.",
      account_blocked: "الحساب محظور.",
      service_unavailable: "الخدمة غير متاحة مؤقتًا. يُرجى المحاولة لاحقًا.",
    },
  },

  // --- register-form ---
  register: {
    usernameLabel: "اسم المستخدم",
    passwordLabel: "كلمة المرور",
    passwordConfirmLabel: "أعد إدخال كلمة المرور",
    submit: "إنشاء حساب",
    fallbackError: "تعذّر إنشاء الحساب.",
    // AuthError codes (backend → UI)
    errors: {
      username_taken: "اسم المستخدم هذا مستخدَم بالفعل.",
      invalid_input: "يُرجى التحقق من تعبئة جميع الحقول بشكل صحيح.",
      too_many_requests: "محاولات كثيرة جدًا. يُرجى المحاولة لاحقًا.",
      service_unavailable: "الخدمة غير متاحة مؤقتًا. يُرجى المحاولة لاحقًا.",
    },
  },

  // --- logout-form (per-device) ---
  logout: {
    trigger: "تسجيل الخروج",
    dialogTitle: "تسجيل الخروج من الحساب؟",
    dialogDescription:
      "ستُحذف المواد المحفوظة دون اتصال من هذا الجهاز. يمكنك تنزيلها مرة أخرى بعد تسجيل الدخول.",
    confirmLabel: "تسجيل الخروج والحذف",
  },

  // --- logout-all-form (all devices) ---
  logoutAll: {
    trigger: "تسجيل الخروج من جميع الأجهزة",
    dialogTitle: "تسجيل الخروج من جميع الأجهزة؟",
    dialogDescription:
      "ستُنهى جميع الجلسات النشطة على كل الأجهزة. وستُحذف المواد المحفوظة دون اتصال من هذا الجهاز.",
    confirmLabel: "تسجيل الخروج من كل مكان",
  },
};

export default auth;
