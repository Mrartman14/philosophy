// src/features/search/schemas.ts
import "server-only";
import { z } from "zod";

import { SEARCH_TYPES } from "./types";

/**
 * Валидация параметров поиска из URL searchParams.
 *
 * Строгие суб-схемы экспортируются для прямого unit-тестирования
 * failure-кейсов. В композитной SearchParamsSchema каждое поле обёрнуто
 * в .optional().catch(undefined): битый параметр (рукописный URL,
 * устаревшая закладка) молча отбрасывается, страница не падает.
 *
 * Лимиты сверены с беком (internal/search/handler.go):
 *  - q: required, max 200 символов;
 *  - type: enum lecture|glossary;
 *  - offset: >= 0. (limit фиксируем на фронте, в URL не выносим.)
 */

export const SearchQuerySchema = z
  .string()
  .trim()
  .min(1, "Введите запрос")
  .max(200, "Не более 200 символов");

export const SearchTypeSchema = z.enum(SEARCH_TYPES);

export const SearchOffsetSchema = z.coerce.number().int().min(0);

export const SearchParamsSchema = z.object({
  q: SearchQuerySchema.optional().catch(undefined),
  type: SearchTypeSchema.optional().catch(undefined),
  offset: SearchOffsetSchema.optional().catch(undefined),
});

export type SearchParamsInput = z.infer<typeof SearchParamsSchema>;
