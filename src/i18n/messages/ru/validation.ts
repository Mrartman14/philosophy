// src/i18n/messages/ru/validation.ts
// Zod-сообщения форм. Схемы — server-only фабрики makeXSchema(t), где
// t = getT("validation") разрешает ключ при parseFormData (request-scope).
// Переиспользуемые сообщения (required/maxLen с {n}) — секция common;
// per-форма строки — под ключом-неймспейсом формы.
const validation = {
  // --- переиспользуемые ---
  required: "Обязательное поле",
  maxLen: "До {n} символов",

  // --- preferences: push.SendRequest (POST /api/admin/push/send) ---
  pushSend: {
    titleRequired: "Введите заголовок",
    titleMax: "До 200 символов",
    bodyMax: "До 1000 символов",
    urlFormat: "URL должен начинаться с «/» или «http(s)://»",
  },
  // --- preferences: push subscribe/unsubscribe ---
  pushSubscribe: {
    endpoint: "Некорректный endpoint подписки",
    p256dh: "Пустой ключ p256dh",
    auth: "Пустой ключ auth",
  },

  // --- auth: login (POST /api/auth/login) ---
  login: {
    usernameRequired: "Введите логин",
    usernameMax: "Слишком длинный логин",
    passwordRequired: "Введите пароль",
    passwordMax: "Слишком длинный пароль",
  },

  // --- auth: register (POST /api/auth/register) ---
  register: {
    usernameMin: "Логин — минимум 3 символа",
    usernameMax: "Логин — максимум 30 символов",
    passwordMin: "Пароль — минимум 6 символов",
    passwordMax: "Слишком длинный пароль",
    passwordConfirmMismatch: "Пароли не совпадают",
  },
};

export default validation;
