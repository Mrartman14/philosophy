// src/features/search/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";

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

type ValidationT = NamespaceT<"validation">;

export function makeSearchQuerySchema(t: ValidationT) {
  return z
    .string()
    .trim()
    .min(1, t("search.queryRequired"))
    .max(200, t("search.queryMax"));
}

export type SearchQueryInput = z.infer<ReturnType<typeof makeSearchQuerySchema>>;

export const SearchTypeSchema = z.enum(SEARCH_TYPES);

export const SearchOffsetSchema = z.coerce.number().int().min(0);

export function makeSearchParamsSchema(t: ValidationT) {
  const q = makeSearchQuerySchema(t);
  return z.object({
    q: q.optional().catch(undefined),
    type: SearchTypeSchema.optional().catch(undefined),
    offset: SearchOffsetSchema.optional().catch(undefined),
  });
}

export type SearchParamsInput = z.infer<ReturnType<typeof makeSearchParamsSchema>>;
