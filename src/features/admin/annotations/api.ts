import { createApiClient } from "@/api/client";
import type { Annotation, ModerationStatus } from "@/api/types";

export interface AdminAnnotationListResult {
  data: Annotation[];
  offset: number;
  limit: number;
  total: number;
}

export async function getAnnotationsAdmin(
  lectureId: string,
  statuses: ModerationStatus[] = [],
  offset = 0,
  limit = 20
): Promise<AdminAnnotationListResult> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/api/admin/annotations", {
    params: {
      query: {
        lecture_id: lectureId,
        ...(statuses.length > 0 ? { status: statuses.join(",") } : {}),
        offset,
        limit,
      },
    },
  });
  if (error || !data) throw new Error("Ошибка загрузки аннотаций");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}
