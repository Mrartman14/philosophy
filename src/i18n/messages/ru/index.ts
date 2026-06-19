// src/i18n/messages/ru/index.ts
// Источник истины формы каталога (Messages = typeof ru). Подмножество ICU:
// только {var} и {count, plural, …}. Никаких select/rich-тегов.
//
// Добавить namespace: создай ru/<ns>.ts + en/<ns>.ts (зеркально), затем добавь
// по одной строке импорта и одному ключу в каждый index (этот и ../en).
// Литералы не нужно помечать `as const`: значения-свойства расширяются до string,
// поэтому `typeof ru` даёт string-листья, а en satisfies Messages проходит.
import admin from "./admin";
import annotations from "./annotations";
import audit from "./audit";
import auth from "./auth";
import banners from "./banners";
import canvas from "./canvas";
import comments from "./comments";
import common from "./common";
import documents from "./documents";
import editor from "./editor";
import errors from "./errors";
import events from "./events";
import forms from "./forms";
import glossary from "./glossary";
import lectures from "./lectures";
import media from "./media";
import metadata from "./metadata";
import notifications from "./notifications";
import pages from "./pages";
import preferences from "./preferences";
import search from "./search";
import shareLinks from "./shareLinks";
import statistics from "./statistics";
import tags from "./tags";
import trails from "./trails";
import users from "./users";
import validation from "./validation";

const ru = {
  admin,
  annotations,
  audit,
  auth,
  banners,
  canvas,
  common,
  comments,
  documents,
  editor,
  errors,
  events,
  forms,
  glossary,
  lectures,
  media,
  metadata,
  notifications,
  pages,
  preferences,
  search,
  shareLinks,
  statistics,
  tags,
  trails,
  users,
  validation,
};

export default ru;

// Messages описывает структуру каталога со string-значениями,
// чтобы en мог satisfies Messages без привязки к конкретным русским литералам.
export type Messages = typeof ru;
