// src/features/search/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";

/**
 * Валидация параметров поиска из URL searchParams.
 *
 * Контракт POST /api/search принимает только `query` + `limit`: фильтра по типу
 * и offset-пагинации на беке больше нет, поэтому в URL живёт единственный
 * параметр `q`. limit фиксируется на странице.
 *
 * Строгая суб-схема `makeSearchQuerySchema` экспортируется для прямого
 * unit-тестирования failure-кейсов. В композитной SearchParamsSchema поле
 * обёрнуто в .optional().catch(undefined): битый параметр (рукописный URL,
 * устаревшая закладка) молча отбрасывается, страница не падает.
 *
 * Лимиты сверены с беком: q required, max 200 символов.
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

export function makeSearchParamsSchema(t: ValidationT) {
  const q = makeSearchQuerySchema(t);
  return z.object({
    q: q.optional().catch(undefined),
  });
}

export type SearchParamsInput = z.infer<ReturnType<typeof makeSearchParamsSchema>>;
