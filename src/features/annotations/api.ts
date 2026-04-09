import { createPublicApiClient } from "@/api/client";
import type { Annotation } from "@/api/types";

export interface AnnotationListResult {
  data: Annotation[];
  offset: number;
  limit: number;
  total: number;
}

export async function getAnnotations(
  lectureId: string,
  offset = 0,
  limit = 100
): Promise<AnnotationListResult> {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/lectures/{id}/annotations", {
    params: {
      path: { id: lectureId },
      query: { offset, limit },
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
