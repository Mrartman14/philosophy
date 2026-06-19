// src/i18n/messages/en/index.ts
// Зеркало ru/: те же namespaces, английские литералы. satisfies Messages
// гарантирует паритет ключей с ru на этапе tsc.
import type { Messages } from "../ru";

import annotations from "./annotations";
import auth from "./auth";
import banners from "./banners";
import canvas from "./canvas";
import comments from "./comments";
import documents from "./documents";
import errors from "./errors";
import events from "./events";
import forms from "./forms";
import lectures from "./lectures";
import media from "./media";
import metadata from "./metadata";
import notifications from "./notifications";
import preferences from "./preferences";
import trails from "./trails";
import validation from "./validation";

const en = {
  annotations,
  auth,
  banners,
  canvas,
  comments,
  documents,
  errors,
  events,
  forms,
  lectures,
  media,
  metadata,
  notifications,
  preferences,
  trails,
  validation,
} satisfies Messages;

export default en;
