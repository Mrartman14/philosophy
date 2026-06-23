"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";

import type { Locale } from "./locales";

/** Сохранить выбранную локаль на бэк (cookie пишется на клиенте). Graceful. */
export async function persistLocale(locale: Locale): Promise<void> {
  try {
    const me = await getMe();
    if (!me) return; // аноним — только cookie
    const api = await createApiClient();
    // PATCH body типизирован через preference.UpdatePreferencesRequest. На момент
    // добавления арабской локали схема ещё перечисляет locale = "system"|"ru"|"en"
    // (без "ar"). СТОПГАП: каст до narrow-типа схемы — runtime реально шлёт "ar",
    // tsc доволен. БЭК-АСК: добавить "ar" в preference.UpdatePreferencesRequest.locale
    // (+ reconcile-on-load). КОГДА схема перегенерирована с "ar" — УБРАТЬ каст.
    await api.PATCH("/api/me/preferences", {
      body: { locale: locale as "system" | "ru" | "en" },
    });
  } catch {
    /* graceful: бэк может не знать про locale */
  }
}
