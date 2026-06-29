// src/i18n/messages/ar/users.ts
// Mirror of ru/users.ts. Key parity enforced by satisfies Messages.
const users = {
  // --- roles ---
  roleUser: "مستخدم",
  roleAdmin: "مشرف",

  // --- statuses ---
  statusActive: "نشط",
  statusSuspended: "موقوف",
  statusBanned: "محظور",

  // --- table ---
  emptyState: "لم يُعثر على مستخدمين",
  colName: "الاسم",
  colRole: "الدور",
  colStatus: "الحالة",
  colCreated: "تاريخ الإنشاء",
  colId: "المعرّف",
  selfBadge: "(أنت)",
  dateFallback: "—",

  // --- user-role-control ---
  roleAriaLabel: "دور المستخدم {username}",
  roleUpdated: "تم تحديث الدور",
  changeRoleAction: "تغيير دور المستخدم",
  changeRoleFailed: "تعذّر تغيير الدور",

  // --- user-status-control ---
  statusAriaLabel: "حالة المستخدم {username}",
  statusUpdated: "تم تحديث الحالة",
  changeStatusAction: "تغيير حالة المستخدم",
  changeStatusFailed: "تعذّر تغيير الحالة",
  confirmBanTitle: "حظر {username}؟",
  confirmBanDescription:
    "لن يتمكّن المستخدم المحظور من تسجيل الدخول. يمكن استرجاع الحالة لاحقًا.",
  confirmBanLabel: "حظر",

  // --- shared across controls ---
  applyButton: "تطبيق",

  // --- CONFLICT sub-mapping ---
  conflictOwnStatus: "لا يمكنك تغيير حالتك الخاصة.",
  conflictOwnRole: "لا يمكنك تغيير دورك الخاص.",
  conflictLastAdmin:
    "لا يمكن إيقاف أو حظر آخر مشرف نشط.",
  conflictDemoteLastAdmin:
    "لا يمكن خفض دور آخر مشرف نشط.",
  conflictFallback: "تعذّر الحفظ: تغيّرت البيانات. حدّث الصفحة وأعد المحاولة.",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "تعذّر تحميل المستخدمين",
  },
};

export default users;
