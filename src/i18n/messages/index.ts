// src/i18n/messages/index.ts
import type { ResolvedLocale } from "../locales";

import en from "./en";
import ru from "./ru";

const CATALOG = { ru, en } as const;

export function loadMessages(locale: ResolvedLocale) {
  return CATALOG[locale];
}
