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
    // PATCH body типизирован через preference.UpdatePreferencesRequest (regen
    // 2026-06-20): locale = "system" | "ru" | "en". Cast снят.
    await api.PATCH("/api/me/preferences", { body: { locale } });
  } catch {
    /* graceful: бэк может не знать про locale */
  }
}
