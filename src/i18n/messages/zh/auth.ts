// src/i18n/messages/zh/auth.ts
// Mirror of ru/auth.ts (Simplified Chinese literals). Key parity enforced by satisfies Messages.
const auth = {
  // --- login-form ---
  login: {
    usernameLabel: "用户名",
    passwordLabel: "密码",
    submit: "登录",
    fallbackError: "登录失败。",
    // AuthError codes (backend → UI)
    errors: {
      invalid_credentials: "用户名或密码错误。",
      account_blocked: "账户已被封禁。",
      service_unavailable: "服务暂时不可用，请稍后再试。",
    },
  },

  // --- register-form ---
  register: {
    usernameLabel: "用户名",
    passwordLabel: "密码",
    passwordConfirmLabel: "再次输入密码",
    submit: "注册",
    fallbackError: "注册失败。",
    // AuthError codes (backend → UI)
    errors: {
      username_taken: "该用户名已被占用。",
      invalid_input: "请检查各字段是否填写正确。",
      too_many_requests: "尝试次数过多，请稍后再试。",
      service_unavailable: "服务暂时不可用，请稍后再试。",
    },
  },

  // --- logout-form (per-device) ---
  logout: {
    trigger: "退出登录",
    dialogTitle: "退出账户登录？",
    dialogDescription:
      "已保存的离线资料将从此设备删除。登录后可重新下载。",
    confirmLabel: "退出并删除",
  },

  // --- logout-all-form (all devices) ---
  logoutAll: {
    trigger: "从所有设备退出登录",
    dialogTitle: "从所有设备退出登录？",
    dialogDescription:
      "所有设备上的活动会话都将被终止。已保存的离线资料将从此设备删除。",
    confirmLabel: "全部退出登录",
  },
};

export default auth;
