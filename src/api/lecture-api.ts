import type { components } from "./schema";

type Lecture = components["schemas"]["lecture.Lecture"];
type ListResult = components["schemas"]["lecture.ListResult"];
type Transcript = components["schemas"]["transcript.Transcript"];

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export async function getLectures(
  page = 1,
  limit = 20,
  q?: string
): Promise<ListResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (q) params.set("q", q);

  const res = await fetch(`${API_URL}/api/lectures?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Failed to fetch lectures: ${res.status}`);
  return res.json();
}

export async function getLectureById(id: string): Promise<Lecture> {
  const res = await fetch(`${API_URL}/api/lectures/${id}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Failed to fetch lecture ${id}: ${res.status}`);
  return res.json();
}

export async function getTranscript(lectureId: string): Promise<Transcript> {
  const res = await fetch(`${API_URL}/api/lectures/${lectureId}/transcript`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok)
    throw new Error(`Failed to fetch transcript for ${lectureId}: ${res.status}`);
  return res.json();
}
