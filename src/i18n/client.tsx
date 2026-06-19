// src/i18n/client.tsx
"use client";
// КЛИЕНТСКИЙ фасад i18n. Прикладной "use client"-код импортирует ТОЛЬКО отсюда.
import { NextIntlClientProvider, useLocale as useIntlLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { getFmt, type Formatters } from "./format";
import type { ResolvedLocale } from "./locales";

/** Обёртка-провайдер next-intl (монтируется в layout). */
export function I18nProvider(props: ComponentProps<typeof NextIntlClientProvider>) {
  return <NextIntlClientProvider {...props} />;
}

/** Клиентский переводчик. Ключи типизированы через AppConfig. */
export const useT = useTranslations;

/** Текущая UI-локаль (ru|en). */
export function useLocale(): ResolvedLocale {
  return useIntlLocale();
}

/** Форматтеры для текущей клиентской локали. */
export function useFmt(): Formatters {
  return getFmt(useLocale());
}
