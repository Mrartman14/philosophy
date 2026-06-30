"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";

export type Lecture = components["schemas"]["lecture.Lecture"];
export type GlossaryTerm = components["schemas"]["glossary.Term"];
// *Summary свёрнуты в *ListItem при scope-фасетном регене (2026-06-30).
export type DocumentSummary = components["schemas"]["document.DocumentListItem"];
export type MediaSummary = components["schemas"]["media.MediaListItem"];
export type CanvasSummary = components["schemas"]["canvas.CanvasSummary"];
export type CommentSummary = components["schemas"]["comment.CommentSummary"];

export interface PickerPage<T> { data: T[]; total: number | null }

/** Пикеры редактора — read-only GET-поиск без доменных кодов: пустая карта,
 * `rethrowApiError` сам делает фоллбек на текст бека / локализуемый serverError
 * (role-403/SUSPENDED/BANNED/422 ловит централизованно). */
const ERRORS: ApiErrorMessageKeys = {};

export async function searchLectures(q: string, offset: number, limit: number): Promise<PickerPage<Lecture>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/lectures", { params: { query: { q, offset, limit } } });
  if (error) rethrowApiError(error, ERRORS);
  return { data: data.data ?? [], total: data.pagination?.total ?? null };
}

export async function searchGlossary(q: string, offset: number, limit: number): Promise<PickerPage<GlossaryTerm>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/glossary", { params: { query: { q, offset, limit } } });
  if (error) rethrowApiError(error, ERRORS);
  return { data: data.data ?? [], total: data.pagination?.total ?? null };
}

export async function searchDocuments(q: string, offset: number, limit: number): Promise<PickerPage<DocumentSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/documents", { params: { query: { q, offset, limit } } });
  if (error) rethrowApiError(error, ERRORS);
  return { data: data.data ?? [], total: data.pagination?.total ?? null };
}

export async function searchMedia(
  q: string,
  offset: number,
  limit: number,
  type?: "video" | "audio",
): Promise<PickerPage<MediaSummary>> {
  const api = await createApiClient();
  const query: { q: string; offset: number; limit: number; type?: "video" | "audio" } = { q, offset, limit };
  if (type) query.type = type;
  const { data, error } = await api.GET("/api/media", { params: { query } });
  if (error) rethrowApiError(error, ERRORS);
  return { data: data.data ?? [], total: data.pagination?.total ?? null };
}

export async function searchCanvases(q: string, offset: number, limit: number): Promise<PickerPage<CanvasSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/canvases", { params: { query: { q, offset, limit } } });
  if (error) rethrowApiError(error, ERRORS);
  return { data: data.data ?? [], total: data.pagination?.total ?? null };
}

export async function searchCommentsByLecture(
  lectureId: string,
  q: string,
  offset: number,
  limit: number,
): Promise<PickerPage<CommentSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/lectures/{id}/comments/search", {
    params: { path: { id: lectureId }, query: { q, offset, limit } },
  });
  if (error) rethrowApiError(error, ERRORS);
  return { data: data.data ?? [], total: data.pagination?.total ?? null };
}
