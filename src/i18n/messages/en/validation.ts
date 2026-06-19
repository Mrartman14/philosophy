// src/i18n/messages/en/validation.ts
// Зеркало ru/validation.ts. Паритет ключей форсит satisfies Messages.
const validation = {
  // --- reusable ---
  required: "Required field",
  maxLen: "Up to {n} characters",

  // --- preferences: push.SendRequest ---
  pushSend: {
    titleRequired: "Enter a title",
    titleMax: "Up to 200 characters",
    bodyMax: "Up to 1000 characters",
    urlFormat: 'URL must start with "/" or "http(s)://"',
  },
  // --- preferences: push subscribe/unsubscribe ---
  pushSubscribe: {
    endpoint: "Invalid subscription endpoint",
    p256dh: "Empty p256dh key",
    auth: "Empty auth key",
  },
};

export default validation;
