// src/i18n/messages/en/index.ts
// Зеркало ru/: те же namespaces, английские литералы. satisfies Messages
// гарантирует паритет ключей с ru на этапе tsc.
import type { Messages } from "../ru";

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

const en = {
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
} satisfies Messages;

export default en;
