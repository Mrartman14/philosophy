// src/i18n/request.ts
// next-intl request config БЕЗ i18n-роутинга: локаль берётся из cookie (getLocale).
import { getRequestConfig } from "next-intl/server";

import { getLocale } from "./locale.server";
import { loadMessages } from "./messages";

export default getRequestConfig(async () => {
  const locale = await getLocale();
  return { locale, messages: loadMessages(locale) };
});
