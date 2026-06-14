// src/features/forms/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type {
  Form,
  FormListItem,
  Submission,
  SubmissionListItem,
} from "./types";

export interface AdminFormListFilter {
  offset?: number;
  limit?: number;
  ownerId?: string;
}

export interface FormListResult {
  items: FormListItem[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Форма по id (GET /api/forms/{id}). 404 → null. token (?token=) пробрасывается
 * для приватных форм через share-link. Аноним без token и без auth получит 404.
 */
export const getFormById = cache(
  async (id: string, token?: string): Promise<Form | null> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error, response } = await api.GET("/api/forms/{id}", {
      params: { path: { id }, query },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить форму");
    return (data?.data ?? null) as Form | null;
  },
);

/** Мои формы (GET /api/me/forms). Гейт — auth. Без пагинации (бек отдаёт все). */
export const getMyForms = cache(async (): Promise<FormListItem[]> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/forms");
  if (error) throw new Error(error.error ?? "Не удалось загрузить формы");
  return (data?.data ?? []) as FormListItem[];
});

/** Мои отклики (GET /api/me/submissions). Гейт — auth. */
export const getMySubmissions = cache(async (): Promise<SubmissionListItem[]> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/submissions");
  if (error) throw new Error(error.error ?? "Не удалось загрузить отклики");
  return (data?.data ?? []) as SubmissionListItem[];
});

/**
 * Список откликов формы (GET /api/forms/{id}/submissions). Только владелец —
 * иначе бек 403. 403/404 → null, чтобы страница показала «нет доступа».
 */
export const getSubmissionsByForm = cache(
  async (formId: string): Promise<SubmissionListItem[] | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/forms/{id}/submissions", {
      params: { path: { id: formId } },
    });
    if (response.status === 403 || response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить отклики");
    return (data?.data ?? []) as SubmissionListItem[];
  },
);

/**
 * Один отклик с ответами (GET /api/submissions/{id}). Видят автор + владелец
 * формы. 404 → null (бек скрывает существование для остальных).
 */
export const getSubmissionById = cache(
  async (id: string): Promise<Submission | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/submissions/{id}", {
      params: { path: { id } },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить отклик");
    return (data?.data ?? null) as Submission | null;
  },
);

/** Admin-список форм (GET /api/admin/forms — только НЕ-private). */
export const getAdminForms = cache(
  async (filter: AdminFormListFilter = {}): Promise<FormListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; owner_id?: string } = { offset, limit };
    if (filter.ownerId) query.owner_id = filter.ownerId;
    const { data, error } = await api.GET("/api/admin/forms", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить формы");
    return {
      items: (data?.data ?? []) as FormListItem[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);
