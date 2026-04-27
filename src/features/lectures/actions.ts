"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { canCreateLecture, canDeleteLecture } from "./permissions";
import {
  LectureCreateSchema,
  LectureIdSchema,
  LectureUpdateSchema,
  LectureVisibilitySchema,
} from "./schemas";
import type { Lecture } from "./types";

type ApiError = { code?: string; error?: string };

function rethrowApiError(err: ApiError | undefined): never {
  if (err?.code === "forbidden") {
    throw new ForbiddenError("role", err.error);
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const createLecture = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(LectureCreateSchema, formData);
  requireCapability(me, canCreateLecture);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/lectures", {
    body: {
      title: input.title,
      description: input.description,
      date: input.date,
      ...(input.visibility !== undefined && { visibility: input.visibility }),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures");
  return (data?.data ?? null) as Lecture | null;
});

export const updateLecture = createFormAction(async (formData) => {
  const input = parseFormData(LectureUpdateSchema, formData);
  // Owner-чек делает бэк (см. spec §8). Маппим 403/404 → ForbiddenError/Error.
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/lectures/{id}", {
    params: { path: { id: input.id } },
    body: { title: input.title, description: input.description, date: input.date },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures", input.id);
  revalidateEntity("lectures");
  return (data?.data ?? null) as Lecture | null;
});

export const setLectureVisibility = createFormAction(async (formData) => {
  const input = parseFormData(LectureVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/lectures/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures", input.id);
  revalidateEntity("lectures");
  return (data?.data ?? null) as Lecture | null;
});

export const deleteLecture = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = LectureIdSchema.parse({ id: rawId });
  requireCapability(me, canDeleteLecture);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/lectures/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures");
  return undefined;
});
