// src/features/share-links/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import {
  rethrowApiError,
  type ApiErrorMessages,
} from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ForbiddenError } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canManageOwnLinks, canModerateShareLinks } from "./permissions";
import { ShareLinkCreateSchema, RevokeTokenSchema } from "./schemas";


/** Доменные коды apperror этого слайса. SUSPENDED/FORBIDDEN/REF_NOT_FOUND и
 * фоллбек "err.error ?? Ошибка сервера" (бывший BAD_REQUEST) — в rethrowApiError. */
const ERRORS: ApiErrorMessages = {
  // Создать ссылку может только владелец; бек маскирует отказ под 404.
  NOT_FOUND: "Ресурс не найден или вы не его владелец.",
  RESOURCE_NOT_PRIVATE: "Ссылку можно создать только для приватного ресурса.",
};

/**
 * Создать share-ссылку. Гейт ownership делает бек (404 на чужой/публичный),
 * фронт лишь проверяет «вообще может мутировать» (active). FormData:
 * resource_type, resource_id, expires_at?.
 */
export const createShareLink = createFormAction(async (formData, ctx) => {
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
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.SHARE_LINKS, input.resource_id);
  return unwrap(data);
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
    if (error) rethrowApiError(error, ERRORS);
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
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.SHARE_LINKS, input.resourceId);
    return true;
  },
);
