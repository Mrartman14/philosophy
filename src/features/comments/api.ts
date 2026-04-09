import { createPublicApiClient } from "@/api/client";
import type { Comment } from "@/api/types";

export interface CommentListResult {
  data: Comment[];
  offset: number;
  limit: number;
  total: number;
}

export async function getComments(
  lectureId: string,
  offset = 0,
  limit = 50
): Promise<CommentListResult> {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/lectures/{id}/comments", {
    params: { path: { id: lectureId }, query: { offset, limit } },
  });
  if (error || !data) throw new Error("Ошибка загрузки комментариев");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}
