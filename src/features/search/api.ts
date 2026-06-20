// src/features/search/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap } from "@/utils/api-unwrap";

import type { SearchHit } from "./types";

export interface SearchFilter {
  /** Поисковый запрос. Уже тримленый/валидный (см. schemas.ts). */
  q: string;
  /** Бек: сколько релевантных хитов вернуть. Фронт фиксирует на странице. */
  limit?: number | undefined;
}

export interface SearchResult {
  items: SearchHit[];
}

/**
 * Семантический (векторный) поиск через POST /api/search. Read-only фича:
 * мутаций нет, revalidateEntity не нужен, тег в src/api/tags.ts не заводится.
 * unstable_cache не используется — выдача зависит от актора (видимость
 * скоупится беком) и от запроса; React.cache дедуплицирует вызовы в рамках
 * одного запроса.
 *
 * Ответ — single-envelope (httputil.Response), пагинации НЕТ: бек принимает
 * только query + limit и возвращает до limit хитов, ранжированных по score.
 *
 * Эндпоинт публичный (optionalAuth) — createApiClient приложит JWT из cookie,
 * если он есть (авторизованный видит свой приватный контент), иначе аноним.
 * При недоступности embedding-sidecar бек отвечает 503 EMBEDDER_UNAVAILABLE —
 * здесь это обычная ошибка запроса (страница рендерит "поиск недоступен").
 */
export const getSearchResults = cache(
  async (filter: SearchFilter): Promise<SearchResult> => {
    const api = await createApiClient();
    const limit = filter.limit ?? 20;

    const { data, error } = await api.POST("/api/search", {
      body: { query: filter.q, limit },
    });
    if (error) {
      const t = await getT("search");
      throw new Error(error.error ?? t("api.fetchFailed"));
    }
    return { items: unwrap<SearchHit[]>(data) ?? [] };
  },
);
