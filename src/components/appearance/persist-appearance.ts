"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getMe } from "@/utils/me";

import type { Appearance } from "./appearance-cookie";

type AppearancePayload = components["schemas"]["preference.AppearancePatch"];

/**
 * FE Appearance → backend preference.AppearancePatch (write-only PATCH shape).
 * `textSize` → `text_size`. Contrast "auto" means "follow OS / unset" and the
 * backend enum is only normal|high, so we OMIT contrast when auto (absent ≡ auto
 * on read-back). Theme's "system" IS a valid backend value, so it's sent as-is.
 */
function toAppearancePayload(a: Appearance): AppearancePayload {
  return {
    theme: a.theme,
    density: a.density,
    font: a.font,
    text_size: a.textSize,
    motion: a.motion,
    ...(a.contrast !== "auto" ? { contrast: a.contrast } : {}),
  };
}

/**
 * Write-through of appearance to the backend (best-effort, cross-device sync).
 * Anonymous → no-op (cookie is the only store). All failures are swallowed:
 * the cookie already holds the user's choice, so a backend hiccup must never
 * break the optimistic UI. getMe() is inside the try because it throws on 5xx.
 */
export async function persistAppearance(appearance: Appearance): Promise<void> {
  try {
    const me = await getMe();
    if (!me) return;
    const api = await createApiClient();
    // PATCH body типизирован через preference.UpdatePreferencesRequest (regen
    // 2026-06-20): appearance — частичный preference.AppearancePatch. Cast снят.
    // Contrast "auto" по-прежнему опускается (AppearancePatch.contrast = normal|high).
    await api.PATCH("/api/me/preferences", {
      body: { appearance: toAppearancePayload(appearance) },
    });
  } catch {
    /* graceful: network/5xx must not break the UI (write-through is best-effort) */
  }
}
