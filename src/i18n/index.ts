// src/i18n/index.ts
// СЕРВЕРНЫЙ фасад i18n. Прикладной server-код импортирует ТОЛЬКО отсюда.
import "server-only";

import { createTranslator } from "next-intl";
import { getMessages as getIntlMessages, getTranslations } from "next-intl/server";

import { getFmt, type Formatters } from "./format";
import { getLocale, getStoredLocale } from "./locale.server";
import { DEFAULT_LOCALE } from "./locales";
import { loadMessages } from "./messages";
import type { Messages as IntlMessages } from "./messages/ru";
import type ruErrors from "./messages/ru/errors";

export { getLocale, getStoredLocale };

/** Серверный переводчик (RSC / server actions). Ключи типизированы через AppConfig. */
export const getT = getTranslations;

/**
 * Тип переводчика для конкретного namespace (без прямого импорта next-intl в
 * прикладном/server-only коде — Guardrail 5). Используется в Zod-схемах-фабриках
 * `makeXSchema(t: NamespaceT<"validation">)`, чтобы типизировать параметр `t`.
 * `NS` ограничен top-level namespace'ами каталога (ключи `Messages`).
 */
export type NamespaceT<NS extends keyof IntlMessages> = Awaited<
  ReturnType<typeof getTranslations<NS>>
>;

/**
 * Ключ namespace «errors» — единый словарь branded-ошибок + api-error кодов.
 * Server-only код (api-error / схемы) держит коды бека как такие ключи, не
 * импортируя next-intl (Guardrail 5). Дрейф ключа краснеет в `tsc`.
 */
export type ErrorKey = keyof typeof ruErrors;

/**
 * Серверный резолв сообщения из namespace «errors» по ключу (+ ICU-параметры).
 * Единый async-seam: api-error/схемы несут ErrorKey синхронно, а перевод
 * происходит ОДИН раз на границе (createAction → toResult).
 *
 * В request-scope (RSC / server action в Next) локаль берётся из cookie через
 * `getTranslations`. Вне request-scope (юнит-тесты, прогретый кеш) `getTranslations`
 * бросает — деградируем к каталогу DEFAULT_LOCALE через `createTranslator`. Так
 * сообщения остаются осмысленными в любом серверном контексте.
 */
export async function resolveErrorMessage(
  key: ErrorKey,
  params?: Record<string, string | number>,
): Promise<string> {
  try {
    const t = await getTranslations("errors");
    return t(key, params);
  } catch {
    const t = createTranslator({
      locale: DEFAULT_LOCALE,
      messages: loadMessages(DEFAULT_LOCALE),
      namespace: "errors",
    });
    return t(key, params);
  }
}

/** Сообщения текущего запроса (для передачи в I18nProvider из layout). */
export function getMessages() {
  return getIntlMessages();
}

/** Форматтеры для текущей серверной локали. */
export async function getServerFmt(): Promise<Formatters> {
  return getFmt(await getLocale());
}
