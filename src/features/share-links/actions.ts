// src/features/share-links/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import { canManageOwnLinks, canModerateShareLinks } from "./permissions";
import { ShareLinkCreateSchema, RevokeTokenSchema } from "./schemas";
import type { ShareLink } from "./types";

type ApiError = { code?: string; error?: string };

/** Маппинг кодов apperror бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "NOT_FOUND":
      // Создать ссылку может только владелец; бек маскирует отказ под 404.
      throw new Error("Ресурс не найден или вы не его владелец.");
    case "RESOURCE_NOT_PRIVATE":
      throw new Error("Ссылку можно создать только для приватного ресурса.");
    // Бек на этих эндпоинтах валит вход через apperror.Validation(...) →
    // код "BAD_REQUEST" (sharelink/handler.go, service.go). Кода
    // "VALIDATION_ERROR" здесь не бывает.
    case "BAD_REQUEST":
      throw new Error(err.error ?? "Сервер отклонил данные.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

/**
 * Создать share-ссылку. Гейт ownership делает бек (404 на чужой/публичный),
 * фронт лишь проверяет «вообще может мутировать» (active). FormData:
 * resource_type, resource_id, expires_at?.
 */
export const createShareLink = createFormAction(async (formData) => {
  const me = await getMe();
  // Defense-in-depth: создание — только для active. Реальный ownership-гейт
  // на беке (canCreateShareLink в UI решает, показывать ли кнопку).
  if (!canManageOwnLinks(me)) {
    throw new ForbiddenError(me ? "status" : "guest");
  }
  const input = parseFormData(ShareLinkCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/share-links", {
    body: {
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      ...(input.expires_at !== undefined
        ? { expires_at: input.expires_at }
        : {}),
    },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.SHARE_LINKS, input.resource_id);
  return (data?.data ?? null) as ShareLink | null;
});

/**
 * Revoke собственной ссылки (создатель). Бек idempotent: повторный revoke —
 * no-op 204. resourceId передаётся отдельно только для ревалидации.
 */
export const revokeShareLink = createAction(
  async (input: { token: string; resourceId: string }): Promise<true> => {
    const me = await getMe();
    if (!canManageOwnLinks(me)) {
      throw new ForbiddenError(me ? "status" : "guest");
    }
    const { token } = RevokeTokenSchema.parse({ token: input.token });
    const api = await createApiClient();
    const { error } = await api.DELETE("/api/share-links/{token}", {
      params: { path: { token } },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.SHARE_LINKS, input.resourceId);
    return true;
  },
);

/**
 * Admin-revoke чужой ссылки (требует share_link.moderate).
 * DELETE /api/admin/share-links/{token}.
 */
export const adminRevokeShareLink = createAction(
  async (input: { token: string; resourceId: string }): Promise<true> => {
    const me = await getMe();
    if (!canModerateShareLinks(me)) {
      throw new ForbiddenError(me ? "role" : "guest");
    }
    const { token } = RevokeTokenSchema.parse({ token: input.token });
    const api = await createApiClient();
    const { error } = await api.DELETE("/api/admin/share-links/{token}", {
      params: { path: { token } },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.SHARE_LINKS, input.resourceId);
    return true;
  },
);
