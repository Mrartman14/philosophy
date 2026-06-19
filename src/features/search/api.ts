// src/features/search/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrapList } from "@/utils/api-unwrap";

import type { SearchHit, SearchType } from "./types";

export interface SearchFilter {
  /** Поисковый запрос. Уже тримленый/валидный (см. schemas.ts). */
  q: string;
  /** Сужение по типу источника. undefined = все (lecture + glossary). */
  type?: SearchType | undefined;
  offset?: number | undefined;
  /** Бек: default 20, max 100. Фронт фиксирует на странице. */
  limit?: number | undefined;
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Глобальный поиск. Read-only фича: мутаций нет, revalidateEntity не нужен,
 * тег в src/api/tags.ts не заводится. unstable_cache не используется —
 * выдача зависит от актора (видимость скоупится беком) и от полнотекстового
 * запроса; React.cache дедуплицирует вызовы в рамках одного запроса.
 *
 * Эндпоинт публичный (optionalAuth) — createApiClient приложит JWT из cookie,
 * если он есть (авторизованный видит свой приватный контент), иначе аноним.
 */
export const getSearchResults = cache(
  async (filter: SearchFilter): Promise<SearchResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: {
      q: string;
      offset: number;
      limit: number;
      type?: SearchType;
    } = { q: filter.q, offset, limit };
    if (filter.type) query.type = filter.type;

    const { data, error } = await api.GET("/api/search", {
      params: { query },
    });
    if (error) {
      const t = await getT("search");
      throw new Error(error.error ?? t("fetchFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);
