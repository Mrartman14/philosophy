// src/i18n/messages/index.ts
import type { AbstractIntlMessages } from "next-intl";

import type { ResolvedLocale } from "../locales";

import en from "./en";
import ru from "./ru";

const CATALOG = { ru, en } as const;

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
 * Возвращает копию каталога без server-only namespace'ов.
 * Используется в getClientMessages() для I18nProvider (RSC-payload оптимизация).
 * Серверный getT/getTranslations продолжает работать через loadMessages (полный каталог).
 */
export function toClientMessages(all: AbstractIntlMessages): AbstractIntlMessages {
  const excluded = new Set<string>(SERVER_ONLY_NAMESPACES);
  return Object.fromEntries(
    Object.entries(all).filter(([ns]) => !excluded.has(ns)),
  );
}
