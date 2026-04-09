import { createPublicApiClient } from "@/api/client";
import type { SearchLectureHit } from "@/api/types";

export interface SearchResult {
  data: SearchLectureHit[];
  offset: number;
  limit: number;
  total: number;
}

export async function search(
  q: string,
  limit = 20,
  offset = 0
): Promise<SearchResult> {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/search", {
    params: { query: { q, limit, offset } },
  });
  if (error || !data) throw new Error("Ошибка поиска");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}
