"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import type { components } from "@/api/schema";

export type Lecture = components["schemas"]["lecture.Lecture"];
export type GlossaryTerm = components["schemas"]["glossary.Term"];
export type DocumentSummary = components["schemas"]["document.DocumentSummary"];
export type MediaSummary = components["schemas"]["media.MediaSummary"];
export type CanvasSummary = components["schemas"]["canvas.CanvasSummary"];
export type CommentSummary = components["schemas"]["comment.CommentSummary"];

export interface PickerPage<T> { data: T[]; total: number | null }

interface ApiError { error?: string }

export async function searchLectures(q: string, offset: number, limit: number): Promise<PickerPage<Lecture>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/lectures", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки лекций");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchGlossary(q: string, offset: number, limit: number): Promise<PickerPage<GlossaryTerm>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/glossary", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки глоссария");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchDocuments(q: string, offset: number, limit: number): Promise<PickerPage<DocumentSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/documents", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки документов");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
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
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки медиа");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchCanvases(q: string, offset: number, limit: number): Promise<PickerPage<CanvasSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/canvases", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки canvas");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
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
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки комментариев");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}
