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
    // PATCH-боди в схеме типизирован как Record<string, never> (бэк не описывает
    // partial-преференсы) → cast обязателен, как в persistAppearance. preference.Locale
    // уже в контракте, но тело PATCH остаётся нетипизированным — as never НЕ снимать.
    await api.PATCH("/api/me/preferences", { body: { locale } as never });
  } catch {
    /* graceful: бэк может не знать про locale */
  }
}
