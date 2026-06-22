// src/i18n/messages/en/index.ts
// Зеркало ru/: те же namespaces, английские литералы. satisfies Messages
// гарантирует паритет ключей с ru на этапе tsc.
import type { Messages } from "../ru";

import admin from "./admin";
import annotations from "./annotations";
import audit from "./audit";
import auth from "./auth";
import banners from "./banners";
import canvas from "./canvas";
import comments from "./comments";
import common from "./common";
import design from "./design";
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
import referenceGraph from "./referenceGraph";
import search from "./search";
import semanticMap from "./semanticMap";
import settings from "./settings";
import shareLinks from "./shareLinks";
import statistics from "./statistics";
import tags from "./tags";
import tokens from "./tokens";
import trails from "./trails";
import users from "./users";
import validation from "./validation";

const en = {
  admin,
  annotations,
  audit,
  auth,
  banners,
  canvas,
  common,
  comments,
  design,
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
  referenceGraph,
  search,
  semanticMap,
  settings,
  shareLinks,
  statistics,
  tags,
  tokens,
  trails,
  users,
  validation,
} satisfies Messages;

export default en;
