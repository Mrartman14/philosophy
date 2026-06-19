// src/i18n/messages/ru/index.ts
// Источник истины формы каталога (Messages = typeof ru). Подмножество ICU:
// только {var} и {count, plural, …}. Никаких select/rich-тегов.
//
// Добавить namespace: создай ru/<ns>.ts + en/<ns>.ts (зеркально), затем добавь
// по одной строке импорта и одному ключу в каждый index (этот и ../en).
// Литералы не нужно помечать `as const`: значения-свойства расширяются до string,
// поэтому `typeof ru` даёт string-листья, а en satisfies Messages проходит.
import metadata from "./metadata";
import notifications from "./notifications";

const ru = {
  metadata,
  notifications,
};

export default ru;

// Messages описывает структуру каталога со string-значениями,
// чтобы en мог satisfies Messages без привязки к конкретным русским литералам.
export type Messages = typeof ru;
