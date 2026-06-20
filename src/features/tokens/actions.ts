// src/features/tokens/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
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

import { canManageTokens } from "./permissions";
import { makeCreateTokenSchema } from "./schemas";
import type { CreatedToken } from "./types";

/** Доменные коды слайса. Остальное (FORBIDDEN/SUSPENDED/фоллбек) — rethrowApiError. */
const ERRORS: ApiErrorMessageKeys = {
  TOKEN_LIMIT: "TOKEN_LIMIT",
};

/**
 * Создать персональный токен. capability-only гейт (active) ДО парсинга.
 * Возвращает CreatedToken (сырой секрет — показать один раз) либо null.
 * FormData: label?, expires_in_days?.
 */
export const createToken = createFormAction(
  async (formData, ctx): Promise<CreatedToken | null> => {
    const me = await getMe();
    if (!canManageTokens(me)) throw new ForbiddenError(me ? "status" : "guest");
    const t = await getT("validation");
    const input = parseFormData(makeCreateTokenSchema(t), formData);
    const api = await createApiClient();
    const { data, error } = await api.POST("/api/me/tokens", {
      body: {
        label: input.label,
        ...(input.expires_in_days !== undefined
          ? { expires_in_days: input.expires_in_days }
          : {}),
      },
      headers: idempotencyHeaders(ctx.idempotencyKey),
    });
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.TOKENS);
    // Ответ типизирован (pat.MintResult) — сырой секрет в поле token, один раз.
    const created = unwrap(data);
    return created ? { token: created.token ?? "" } : null;
  },
  "createToken",
);

/**
 * Отозвать токен по id. DELETE /api/me/tokens/{id}. Бек скоупит к актору
 * (чужой id → 404). Идемпотентен по эффекту — отдельного Idempotency-Key не нужно.
 */
export const revokeToken = createAction(
  async (input: { id: string }): Promise<true> => {
    const me = await getMe();
    if (!canManageTokens(me)) throw new ForbiddenError(me ? "status" : "guest");
    const api = await createApiClient();
    const { error } = await api.DELETE("/api/me/tokens/{id}", {
      params: { path: { id: input.id } },
    });
    if (error) rethrowApiError(error);
    revalidateEntity(Tags.TOKENS);
    return true;
  },
  "revokeToken",
);
