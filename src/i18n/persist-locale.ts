"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";

import { PSEUDO_LOCALE, type Locale } from "./locales";

/** Сохранить выбранную локаль на бэк (cookie пишется на клиенте). Graceful. */
export async function persistLocale(locale: Locale): Promise<void> {
  // Псевдолокаль (en-XA) — dev-only QA лейаута, не входит в контракт бэка и не
  // персистится. Guard сужает тип до schema-enum "system"|"ru"|"en"|"ar"|"zh".
  if (locale === PSEUDO_LOCALE) return;
  try {
    const me = await getMe();
    if (!me) return; // аноним — только cookie
    const api = await createApiClient();
    // PATCH body типизирован через preference.UpdatePreferencesRequest, чей
    // locale-enum после регена схемы перечисляет все реальные локали (вкл. ar/zh).
    await api.PATCH("/api/me/preferences", {
      body: { locale },
    });
  } catch {
    /* graceful: бэк может не знать про locale */
  }
}
