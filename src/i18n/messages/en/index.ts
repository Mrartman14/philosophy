// src/i18n/messages/en/index.ts
// Зеркало ru/: те же namespaces, английские литералы. satisfies Messages
// гарантирует паритет ключей с ru на этапе tsc.
import type { Messages } from "../ru";

import auth from "./auth";
import canvas from "./canvas";
import comments from "./comments";
import errors from "./errors";
import metadata from "./metadata";
import notifications from "./notifications";
import preferences from "./preferences";
import validation from "./validation";

const en = {
  auth,
  canvas,
  comments,
  errors,
  metadata,
  notifications,
  preferences,
  validation,
} satisfies Messages;

export default en;
