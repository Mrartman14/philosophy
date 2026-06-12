// src/features/preferences/types.ts
import type { components } from "@/api/schema";

/** GET/PATCH /api/me/preferences. Бекенд: internal/preference/model.go */
export type Preferences = components["schemas"]["preference.Preferences"];

/**
 * Допустимые значения reading_mode — зеркало validReadingModes бекенда
 * (internal/preference/model.go: ReadingModeFull / ReadingModeFocused).
 */
export const READING_MODES = ["full", "focused"] as const;
export type ReadingMode = (typeof READING_MODES)[number];
