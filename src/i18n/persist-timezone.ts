"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";
import type { TzPref } from "@/utils/timezone";

/** Сохранить выбранную зону на бэк (cookie пишется на клиенте). Graceful. */
export async function persistTimezone(pref: TzPref): Promise<void> {
  try {
    const me = await getMe();
    if (!me) return; // аноним — только cookie
    const api = await createApiClient();
    await api.PATCH("/api/me/preferences", { body: { timezone: pref } });
  } catch {
    /* graceful */
  }
}
