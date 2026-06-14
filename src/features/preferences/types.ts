// src/features/preferences/types.ts
import type { components } from "@/api/schema";

/** GET/PATCH /api/me/preferences. Бекенд: internal/preference/model.go */
export type Preferences = components["schemas"]["preference.Preferences"];

/** Режим чтения (бек: `preference.ReadingMode`). */
export type ReadingMode = components["schemas"]["preference.ReadingMode"];

/** Рантайм-значения для Zod (`z.enum`) — заякорены на `preference.ReadingMode`:
 * лишнее/устаревшее значение сломает сборку после regen `schema.ts`. */
export const READING_MODES = ["full", "focused"] as const satisfies readonly ReadingMode[];
