import { createPublicApiClient } from "@/api/client";
import type { Lecture, LectureFile, Transcript } from "@/api/types";

export interface LectureListResult {
  data: Lecture[];
  offset: number;
  limit: number;
  total: number;
}

export async function getLectures(
  offset = 0,
  limit = 20,
  q?: string
): Promise<LectureListResult> {
  const client = createPublicApiClient();
  const query: { offset: number; limit: number; q?: string } = {
    offset,
    limit,
  };
  if (q) query.q = q;
  const { data, error } = await client.GET("/api/lectures", {
    params: { query },
    next: { revalidate: 3600 },
  });
  if (error || !data) throw new Error("Failed to fetch lectures");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}

export async function getLectureById(id: string): Promise<Lecture> {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/lectures/{id}", {
    params: { path: { id } },
    next: { revalidate: 3600 },
  });
  if (error || !data?.data) throw new Error(`Failed to fetch lecture ${id}`);
  return data.data;
}

export async function getLectureFiles(
  lectureId: string
): Promise<LectureFile[]> {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/lectures/{id}/files", {
    params: { path: { id: lectureId } },
    next: { revalidate: 3600 },
  });
  if (error || !data) throw new Error(`Failed to fetch files for ${lectureId}`);
  return data.data ?? [];
}

export async function getTranscript(lectureId: string): Promise<Transcript> {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/lectures/{id}/transcript", {
    params: { path: { id: lectureId } },
    next: { revalidate: 3600 },
  });
  if (error || !data?.data)
    throw new Error(`Failed to fetch transcript for ${lectureId}`);
  return data.data;
}
