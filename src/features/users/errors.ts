// src/features/users/errors.ts
import "server-only";
import type { ApiError } from "@/utils/api-error";
import { ForbiddenError } from "@/utils/permissions";

/** Алиас общего {@link ApiError} — `code` типизирован сгенерированным
 * union `apperror.Code` (источник истины — `internal/apperror/codes.go`). */
export type UserApiError = ApiError;

/**
 * 409-гарды users-admin возвращают единый код "CONFLICT" — различаем по
 * точному message. Строки — из philosophy-api/internal/user/service.go
 * (строки 138, 153, 189, 202). При изменении текстов на беке сработает
 * общий фоллбек ниже — UX не сломается, но текст станет менее точным.
 */
const CONFLICT_MESSAGES: Record<string, string> = {
  "cannot modify your own status": "Нельзя изменить собственный статус.",
  "cannot modify your own role": "Нельзя изменить собственную роль.",
  "cannot remove the last active admin":
    "Нельзя приостановить или заблокировать последнего активного администратора.",
  "cannot demote the last active admin":
    "Нельзя понизить роль последнего активного администратора.",
};

/**
 * Переводит ошибку бекенда в throw с понятным русским текстом.
 * ForbiddenError ловится createAction → { success: false, code: "forbidden" },
 * клиент показывает branded-текст «У вас нет прав на …».
 */
export function rethrowUserApiError(err: UserApiError | undefined): never {
  if (err?.code === "FORBIDDEN") {
    throw new ForbiddenError("role", err.error);
  }
  if (err?.code === "SUSPENDED" || err?.code === "BANNED") {
    throw new Error("Ваш аккаунт ограничен — действие недоступно.");
  }
  if (err?.code === "CONFLICT") {
    const friendly = err.error ? CONFLICT_MESSAGES[err.error] : undefined;
    throw new Error(friendly ?? "Операция отклонена сервером (конфликт).");
  }
  if (err?.code === "NOT_FOUND") {
    throw new Error("Пользователь не найден.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}
