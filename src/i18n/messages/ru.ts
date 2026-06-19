// src/i18n/messages/ru.ts
// Источник истины формы каталога (Messages = typeof ru). Подмножество ICU:
// только {var} и {count, plural, …}. Никаких select/rich-тегов.
const ru = {
  metadata: {
    appTitle: "Философия-ликбез",
    appDescription: "Архив занятий курса Философия-ликбез",
    appShortName: "ФЛБЗ",
    settingsTitle: "Настройки",
  },
  notifications: {
    documentUpdated: "Документ, на который вы подписаны, обновлён",
    commentCreated:
      "{count, plural, one{# новый комментарий} few{# новых комментария} many{# новых комментариев} other{# новых комментариев}}",
    commentReply: "Ответ на ваш комментарий",
    annotationCreated: "Новая аннотация",
    mention: "Вас упомянули",
    fallback: "Новое уведомление",
  },
} as const;

export default ru;

// Messages описывает структуру каталога со string-значениями,
// чтобы en.ts мог satisfies Messages без привязки к конкретным русским литералам.
type DeepString<T> = {
  [K in keyof T]: T[K] extends Record<string, unknown> ? DeepString<T[K]> : string;
};
export type Messages = DeepString<typeof ru>;
