// src/i18n/index.ts
// СЕРВЕРНЫЙ фасад i18n. Прикладной server-код импортирует ТОЛЬКО отсюда.
import "server-only";

import { getMessages as getIntlMessages, getTranslations } from "next-intl/server";

import { getFmt, type Formatters } from "./format";
import { getLocale, getStoredLocale } from "./locale.server";

export { getLocale, getStoredLocale };

/** Серверный переводчик (RSC / server actions). Ключи типизированы через AppConfig. */
export const getT = getTranslations;

/** Сообщения текущего запроса (для передачи в I18nProvider из layout). */
export function getMessages() {
  return getIntlMessages();
}

/** Форматтеры для текущей серверной локали. */
export async function getServerFmt(): Promise<Formatters> {
  return getFmt(await getLocale());
}
