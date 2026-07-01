// src/features/forms/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

import type {
  FieldAnswerItem,
  Form,
  FormListItem,
  FormStats,
  Submission,
  SubmissionListItem,
} from "./types";

export interface AdminFormListFilter {
  offset?: number;
  limit?: number;
  ownerId?: string;
}

/** Фильтр листинга «моих» форм (scope=mine). owner_id неприменим — это всегда свои. */
export interface MyFormListFilter {
  offset?: number;
  limit?: number;
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
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadItemFailed"));
    return unwrap(data);
  },
);

/**
 * Мои формы (GET /api/forms?scope=mine). Гейт — auth. scope=mine отдаёт свои
 * формы ВКЛЮЧАЯ приватные. Бек УДАЛИЛ непагинированный /api/me/forms — единый
 * листинг /api/forms пагинирован (httputil.ListResponse), поэтому возвращаем
 * FormListResult, как getAdminForms. scope передаём ЯВНО (дефолт бека = visible).
 */
export const getMyForms = cache(
  async (filter: MyFormListFilter = {}): Promise<FormListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { scope: "mine"; offset: number; limit: number } = {
      scope: "mine",
      offset,
      limit,
    };
    const { data, error } = await api.GET("/api/forms", { params: { query } });
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadMyFailed"));
    return unwrapList(data, { offset, limit });
  },
);

/** Мои отклики (GET /api/me/submissions). Гейт — auth. */
export const getMySubmissions = cache(async (): Promise<SubmissionListItem[]> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/submissions");
  if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadMySubmissionsFailed"));
  return unwrap(data) ?? [];
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
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadSubmissionsFailed"));
    return unwrap(data) ?? [];
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
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadSubmissionFailed"));
    return unwrap(data);
  },
);

/**
 * Admin-список форм (GET /api/forms?scope=all). Бек УДАЛИЛ /api/admin/forms —
 * платформенная модерация теперь scope=all (non-private платформенно, требует
 * form.delete_any; 403 без капы). owner_id-фильтр допустим только при scope=all.
 * Гейт страницы (canListAdminForms) отсеивает запрос без капы до фетча.
 */
export const getAdminForms = cache(
  async (filter: AdminFormListFilter = {}): Promise<FormListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { scope: "all"; offset: number; limit: number; owner_id?: string } = {
      scope: "all",
      offset,
      limit,
    };
    if (filter.ownerId) query.owner_id = filter.ownerId;
    const { data, error } = await api.GET("/api/forms", { params: { query } });
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadAdminFailed"));
    return unwrapList(data, { offset, limit });
  },
);

/**
 * Агрегат результатов формы (GET /api/forms/{id}/stats). Периметр результатов
 * (владелец ∨ публичные результаты); 403/404 → null, чтобы роут отдал forbidden/404.
 * token (?token=) — для приватной формы через share-link.
 */
export const getFormStats = cache(
  async (id: string, token?: string): Promise<FormStats | null> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error, response } = await api.GET("/api/forms/{id}/stats", {
      params: { path: { id }, query },
    });
    if (response.status === 403 || response.status === 404) return null;
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadStatsFailed"));
    return unwrap(data);
  },
);

/**
 * Колоночный просмотр ответов одного поля (GET /api/forms/{id}/fields/{fieldId}/answers).
 * Пагинация, тот же периметр, что и stats. 403/404 → null.
 */
export const getFieldAnswers = cache(
  async (
    id: string,
    fieldId: string,
    opts: { token?: string; offset?: number; limit?: number } = {},
  ): Promise<{ items: FieldAnswerItem[]; total: number; offset: number; limit: number } | null> => {
    const api = await createApiClient();
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;
    const query: { token?: string; offset: number; limit: number } = { offset, limit };
    if (opts.token) query.token = opts.token;
    const { data, error, response } = await api.GET(
      "/api/forms/{id}/fields/{fieldId}/answers",
      { params: { path: { id, fieldId }, query } },
    );
    if (response.status === 403 || response.status === 404) return null;
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadFieldAnswersFailed"));
    return unwrapList(data, { offset, limit });
  },
);
