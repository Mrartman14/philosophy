import { createApiClient } from "@/api/client";
import type { Comment, ModerationStatus } from "@/api/types";

export interface AdminCommentListResult {
  data: Comment[];
  offset: number;
  limit: number;
  total: number;
}

export async function getCommentsAdmin(
  lectureId: string,
  statuses: ModerationStatus[] = [],
  offset = 0,
  limit = 20
): Promise<AdminCommentListResult> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/api/admin/comments", {
    params: {
      query: {
        lecture_id: lectureId,
        ...(statuses.length > 0 ? { status: statuses.join(",") } : {}),
        offset,
        limit,
      },
    },
  });
  if (error || !data) throw new Error("Ошибка загрузки комментариев");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}
