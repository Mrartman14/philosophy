// src/i18n/messages/ru/index.ts
// Источник истины формы каталога (Messages = typeof ru). Подмножество ICU:
// только {var} и {count, plural, …}. Никаких select/rich-тегов.
//
// Добавить namespace: создай ru/<ns>.ts + en/<ns>.ts (зеркально), затем добавь
// по одной строке импорта и одному ключу в каждый index (этот и ../en).
// Литералы не нужно помечать `as const`: значения-свойства расширяются до string,
// поэтому `typeof ru` даёт string-листья, а en satisfies Messages проходит.
import auth from "./auth";
import banners from "./banners";
import canvas from "./canvas";
import comments from "./comments";
import documents from "./documents";
import errors from "./errors";
import forms from "./forms";
import lectures from "./lectures";
import metadata from "./metadata";
import notifications from "./notifications";
import preferences from "./preferences";
import validation from "./validation";

const ru = {
  auth,
  banners,
  canvas,
  comments,
  documents,
  errors,
  forms,
  lectures,
  metadata,
  notifications,
  preferences,
  validation,
};

export default ru;

// Messages описывает структуру каталога со string-значениями,
// чтобы en мог satisfies Messages без привязки к конкретным русским литералам.
export type Messages = typeof ru;
