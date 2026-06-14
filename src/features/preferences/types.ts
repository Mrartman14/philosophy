// src/features/preferences/types.ts
import type { components } from "@/api/schema";

/** GET/PATCH /api/me/preferences. Бекенд: internal/preference/model.go */
export type Preferences = components["schemas"]["preference.Preferences"];

/** Режим чтения (бек: `preference.ReadingMode`). */
export type ReadingMode = components["schemas"]["preference.ReadingMode"];

/** Рантайм-значения reading_mode — единый источник в `@/api/enums`. */
export { READING_MODES } from "@/api/enums";
