// src/i18n/messages/en/index.ts
// Зеркало ru/: те же namespaces, английские литералы. satisfies Messages
// гарантирует паритет ключей с ru на этапе tsc.
import type { Messages } from "../ru";

import metadata from "./metadata";
import notifications from "./notifications";

const en = {
  metadata,
  notifications,
} satisfies Messages;

export default en;
