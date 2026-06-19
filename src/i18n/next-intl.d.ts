// src/i18n/next-intl.d.ts
// Глобальная типизация next-intl: ключи сообщений и набор локалей проверяются tsc.
import type { ResolvedLocale } from "./locales";
import type { Messages } from "./messages/ru";

declare module "next-intl" {
  interface AppConfig {
    Locale: ResolvedLocale;
    Messages: Messages;
  }
}
