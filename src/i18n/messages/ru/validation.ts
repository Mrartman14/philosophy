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
};

export default validation;
