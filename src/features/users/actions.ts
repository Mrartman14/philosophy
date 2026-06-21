// src/features/users/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import {
  rethrowApiError,
  type ApiError,
  type ApiErrorMessageKeys,
} from "@/utils/api-error";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canModerateUsers } from "./permissions";
import { makeUserRoleUpdateSchema, makeUserStatusUpdateSchema } from "./schemas";
import type { AdminUser } from "./types";

/**
 * 409-гарды users-admin возвращают единый код "CONFLICT" — различаем по
 * точному message. Строки — из philosophy-api/internal/user/service.go
 * (строки 138, 153, 189, 202). При изменении текстов на беке сработает
 * общий фоллбек ниже — UX не сломается, но текст станет менее точным.
 *
 * NOTE: CONFLICT_MESSAGES остаётся легаси-каналом (Error(text)), поскольку
 * `rethrowUserApiError` синхронна и не может вызвать `await getT("users")`.
 * Локализация CONFLICT-ветки требует перехода на async + обновления actions.ts
 * — отложено как отдельная задача (см. concerns в i18n-задаче).
 * Русские строки здесь совпадают с ключами users.conflict* в каталоге.
 */
const CONFLICT_MESSAGES: Record<string, string> = {
  "cannot modify your own status": "Нельзя изменить собственный статус.",
  "cannot modify your own role": "Нельзя изменить собственную роль.",
  "cannot remove the last active admin":
    "Нельзя приостановить или заблокировать последнего активного администратора.",
  "cannot demote the last active admin":
    "Нельзя понизить роль последнего активного администратора.",
};

/** Доменные коды users-admin. FORBIDDEN/SUSPENDED обрабатывает централизованный
 * {@link rethrowApiError} (branded ForbiddenError); BANNED → BannedError
 * (форс-логаут актора, ловится в createAction → redirect). */
const ERRORS: ApiErrorMessageKeys = {
  NOT_FOUND: "USER_NOT_FOUND",
};

/**
 * Локальная обёртка: переводит ошибку бекенда в throw с понятным текстом.
 * ForbiddenError ловится createAction → { success: false, code: "forbidden" },
 * клиент показывает branded-текст «У вас нет прав на …».
 *
 * CONFLICT с под-маппингом по message обрабатывается локально (общая карта
 * умеет только code→текст), остальное делегируется в {@link rethrowApiError}.
 */
function rethrowUserApiError(err: ApiError | undefined): never {
  if (err?.code === "CONFLICT") {
    const friendly = err.error ? CONFLICT_MESSAGES[err.error] : undefined;
    throw new Error(friendly ?? "Операция отклонена сервером (конфликт).");
  }
  rethrowApiError(err, ERRORS);
}

/**
 * Смена роли пользователя. PUT /api/admin/users/{id}/role (user.moderate).
 * Гарды «не себя» / «не последнего активного админа» enforce'ит бекенд (409) —
 * переводятся в русские тексты в rethrowUserApiError.
 */
export const setUserRole = createAction(
  async (input: { id: string; role: string }): Promise<AdminUser | null> => {
    const me = await getMe();
    requireCapability(me, canModerateUsers);
    const parsed = makeUserRoleUpdateSchema(await getT("validation")).parse(input);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/admin/users/{id}/role", {
      params: { path: { id: parsed.id } },
      body: { role: parsed.role },
    });
    if (error) rethrowUserApiError(error);
    revalidateEntity(Tags.USERS);
    return data.data ?? null;
  },
  "setUserRole",
);

/**
 * Смена статуса пользователя. PUT /api/admin/users/{id}/status (user.moderate).
 */
export const setUserStatus = createAction(
  async (input: { id: string; status: string }): Promise<AdminUser | null> => {
    const me = await getMe();
    requireCapability(me, canModerateUsers);
    const parsed = makeUserStatusUpdateSchema(await getT("validation")).parse(input);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/admin/users/{id}/status", {
      params: { path: { id: parsed.id } },
      body: { status: parsed.status },
    });
    if (error) rethrowUserApiError(error);
    revalidateEntity(Tags.USERS);
    return data.data ?? null;
  },
  "setUserStatus",
);
