// src/features/glossary/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type { Term } from "./types";

export interface TermListFilter {
  q?: string;
  offset?: number;
  limit?: number;
}

export interface TermListResult {
  items: Term[];
  total: number;
  offset: number;
  limit: number;
}

export const getTerms = cache(
  async (filter: TermListFilter = {}): Promise<TermListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const query: { offset: number; limit: number; q?: string } = { offset, limit };
    if (filter.q) query.q = filter.q;

    const { data, error } = await api.GET("/api/glossary", { params: { query } });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить термины");
    }
    return {
      items: (data?.data ?? []) as Term[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

export const getTermById = cache(async (id: string): Promise<Term | null> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/glossary/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404) return null;
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить термин");
  }
  return (data?.data ?? null) as Term | null;
});
