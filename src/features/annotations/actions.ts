"use server";

import { revalidatePath } from "next/cache";
import { createApiClient } from "@/api/client";
import { createAction, createFormAction } from "@/utils/create-action";
import type {
  AnnotationCreateRequest,
  AnnotationUpdateRequest,
} from "@/api/types";

function parseSegmentIds(raw: FormDataEntryValue | null): number[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  return raw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

export const createAnnotation = createFormAction(async (formData: FormData) => {
  const lectureId = String(formData.get("lecture_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const segmentIds = parseSegmentIds(formData.get("segment_ids"));
  const isPrivate = formData.get("is_private") === "on";
  const isAnonymous = formData.get("is_anonymous") === "on";

  if (!lectureId) throw new Error("Не указана лекция");
  if (!body) throw new Error("Текст аннотации не может быть пустым");
  if (segmentIds.length === 0)
    throw new Error("Нужно выбрать хотя бы один сегмент");

  const client = await createApiClient();
  const requestBody: AnnotationCreateRequest = {
    body,
    segment_ids: segmentIds,
    is_private: isPrivate,
    is_anonymous: isAnonymous,
  };

  const { data, error } = await client.POST(
    "/api/lectures/{id}/annotations",
    {
      params: { path: { id: lectureId } },
      body: requestBody,
    }
  );
  if (error || !data?.data) throw new Error("Не удалось создать аннотацию");

  revalidatePath(`/lectures/${lectureId}`);
  return data.data;
});

export const editAnnotation = createFormAction(async (formData: FormData) => {
  const annotationId = String(formData.get("annotation_id") ?? "");
  const lectureId = String(formData.get("lecture_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const segmentIds = parseSegmentIds(formData.get("segment_ids"));

  if (!annotationId) throw new Error("Не указана аннотация");
  if (!body) throw new Error("Текст аннотации не может быть пустым");
  if (segmentIds.length === 0)
    throw new Error("Нужно выбрать хотя бы один сегмент");

  const client = await createApiClient();
  const requestBody: AnnotationUpdateRequest = {
    body,
    segment_ids: segmentIds,
  };

  const { data, error } = await client.PUT("/api/annotations/{id}", {
    params: { path: { id: annotationId } },
    body: requestBody,
  });
  if (error || !data?.data) throw new Error("Не удалось обновить аннотацию");

  if (lectureId) revalidatePath(`/lectures/${lectureId}`);
  return data.data;
});

export const deleteAnnotation = createAction(
  async (input: { annotationId: string; lectureId?: string }) => {
    const client = await createApiClient();
    const { error } = await client.DELETE("/api/annotations/{id}", {
      params: { path: { id: input.annotationId } },
    });
    if (error) throw new Error("Не удалось удалить аннотацию");

    if (input.lectureId) revalidatePath(`/lectures/${input.lectureId}`);
    return { id: input.annotationId };
  }
);
