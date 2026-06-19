"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";

import type { Appearance } from "./appearance-cookie";

/** camelCase Appearance → snake_case payload бэка. */
function toPayload(a: Appearance) {
  return { theme: a.theme, contrast: a.contrast, density: a.density, font: a.font, text_size: a.textSize };
}

export async function persistAppearance(appearance: Appearance): Promise<void> {
  try {
    const me = await getMe();
    if (!me) return; // аноним — только cookie
    const api = await createApiClient();
    // Бэк-поля appearance ещё не в контракте → as never; снять в Task 21 после регена schema.ts.
    await api.PATCH("/api/me/preferences", { body: toPayload(appearance) as never });
  } catch { /* graceful: бэк может не знать про appearance */ }
}
