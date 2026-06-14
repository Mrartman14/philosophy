// src/features/search/types.ts
import type { components } from "@/api/schema";

/**
 * Результаты GET /api/search. Бек индексирует ДВА типа источников —
 * lecture и glossary (internal/search: NewGlossarySource + NewLectureSource);
 * документы/медиа/комментарии в глобальный поиск НЕ попадают.
 *
 * Все поля в сгенерированных типах optional — UI обязан граничить
 * отсутствующие значения (рендер "—" / skip).
 */
export type SearchHit = components["schemas"]["search.Hit"];
export type SearchLectureData = components["schemas"]["search.LectureData"];
export type SearchGlossaryData = components["schemas"]["search.GlossaryData"];
export type SearchMatch = components["schemas"]["search.Match"];

/** Тип источника поиска (бек: `search.HitType`). */
export type SearchType = components["schemas"]["search.HitType"];

/** Рантайм-значения для Zod/UI — единый источник в `@/api/enums`. */
export { SEARCH_HIT_TYPES as SEARCH_TYPES } from "@/api/enums";
