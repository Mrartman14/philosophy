import "server-only";

import { cookies } from "next/headers";

import {
  APPEARANCE_COOKIE,
  DEFAULT_APPEARANCE,
  parseAppearance,
  type Appearance,
} from "@/components/appearance/appearance-cookie";
import { getPreferences, type Preferences } from "@/features/preferences";
import { getMe } from "@/utils/me";

/**
 * Backend preference.Appearance → FE Appearance. Missing fields fall back to
 * defaults; an absent `contrast` means "follow OS" → "auto" (the backend enum
 * is only normal|high, so "auto" is represented by omission — see
 * persist-appearance.ts).
 */
function fromBackend(a: Preferences["appearance"]): Appearance {
  return {
    theme: a?.theme ?? DEFAULT_APPEARANCE.theme,
    contrast: a?.contrast ?? "auto",
    density: a?.density ?? DEFAULT_APPEARANCE.density,
    font: a?.font ?? DEFAULT_APPEARANCE.font,
    textSize: a?.text_size ?? DEFAULT_APPEARANCE.textSize,
    motion: a?.motion ?? "system",
    // СТОПГАП: бэкенд preference.Appearance ещё не несёт text_align (бэк-аск открыт).
    // До регена схемы ось — cookie-only (cross-device sync неактивен), на новом
    // устройстве дефолтим в start. Когда поле появится → `a?.text_align ?? DEFAULT`.
    textAlign: DEFAULT_APPEARANCE.textAlign,
  };
}

/**
 * Resolve the user's appearance for SSR (no-FOUC).
 *
 * Cookie is the fast same-device cache and is authoritative when present (every
 * change is written through to it client-side, and to the backend). When the
 * cookie is ABSENT (fresh session / new device), seed from the backend for an
 * authenticated user so their saved preferences render correctly cross-device;
 * the client then writes the cookie on mount so subsequent SSR stays fast.
 * Anonymous or any backend hiccup → defaults.
 */
export async function getAppearance(): Promise<Appearance> {
  const store = await cookies();
  const raw = store.get(APPEARANCE_COOKIE)?.value;
  if (raw) return parseAppearance(raw);

  try {
    if (await getMe()) {
      const prefs = await getPreferences();
      return fromBackend(prefs.appearance);
    }
  } catch {
    /* backend unavailable → fall through to defaults (cookie path stays primary) */
  }
  return DEFAULT_APPEARANCE;
}
