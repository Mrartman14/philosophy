// src/i18n/messages/index.ts
import type { AbstractIntlMessages } from "next-intl";

import type { ResolvedLocale } from "../locales";

import ar from "./ar";
import en from "./en";
import pseudo from "./pseudo";
import ru from "./ru";
import zh from "./zh";

const CATALOG = { ru, en, ar, zh, "en-XA": pseudo } as const;

export function loadMessages(locale: ResolvedLocale) {
  return CATALOG[locale];
}

/**
 * Namespace'ы, используемые ТОЛЬКО на сервере (getT/getTranslations).
 * На клиенте (useT/useTranslations) их нет → не надо слать в I18nProvider.
 * Guard-тест src/i18n/server-only-namespaces.test.ts защищает от дрейфа:
 * если кто-то добавит useT("validation") — тест упадёт.
 */
export const SERVER_ONLY_NAMESPACES = ["validation", "metadata"] as const;

/**
 * Branded camelCase-ключи namespace `errors`, которые РЕАЛЬНО нужны клиенту
 * (через `tErrors(...)` / `useT("errors")`): forbidden-seam + generic-фоллбеки.
 *
 * Остальные ~80 ключей `errors` — это api-error КОДЫ в SCREAMING_SNAKE_CASE
 * (REF_NOT_FOUND, VERSION_MISMATCH, IDEMPOTENCY_*, FORM_*, …), которые резолвятся
 * ИСКЛЮЧИТЕЛЬНО на сервере (`resolveErrorMessage` через полный `loadMessages`).
 * Клиент их никогда не зовёт — `toClientMessages` отфильтровывает их из проекции,
 * чтобы не слать ~9 КБ мёртвых строк в I18nProvider (RSC-payload оптимизация).
 *
 * Guard-тест src/i18n/errors-client-keys.test.ts защищает от дрейфа в обе стороны:
 * (a) каждый ключ существует в каталоге; (b) клиент не зовёт error-ключ вне списка.
 */
export const CLIENT_ERROR_KEYS = [
  "serverError",
  "accountRestricted",
  "forbiddenAction",
  "forbiddenGeneric",
  "forbiddenTitle",
  "failureTitle",
  "unknown",
] as const;

/**
 * Возвращает копию каталога без server-only namespace'ов + урезанным `errors`.
 * Используется в getClientMessages() для I18nProvider (RSC-payload оптимизация).
 * Серверный getT/getTranslations продолжает работать через loadMessages (полный каталог).
 *
 * Гранулярность фильтра двухуровневая:
 * - целые namespace'ы из SERVER_ONLY_NAMESPACES (validation/metadata) — исключаются;
 * - внутри `errors` остаются ТОЛЬКО CLIENT_ERROR_KEYS (branded), api-коды отсекаются.
 */
export function toClientMessages(all: AbstractIntlMessages): AbstractIntlMessages {
  const excluded = new Set<string>(SERVER_ONLY_NAMESPACES);
  const clientErrorKeys = new Set<string>(CLIENT_ERROR_KEYS);
  const entries: [string, AbstractIntlMessages | string][] = [];
  for (const [ns, value] of Object.entries(all)) {
    if (excluded.has(ns)) continue;
    // namespace `errors` — отдаём клиенту ТОЛЬКО branded-ключи (CLIENT_ERROR_KEYS),
    // api-error КОДЫ (SCREAMING_SNAKE) резолвятся на сервере и не нужны клиенту.
    if (ns === "errors" && typeof value === "object") {
      const trimmed: AbstractIntlMessages = {};
      for (const [key, val] of Object.entries(value)) {
        if (clientErrorKeys.has(key)) trimmed[key] = val;
      }
      entries.push([ns, trimmed]);
      continue;
    }
    entries.push([ns, value]);
  }
  return Object.fromEntries(entries);
}
