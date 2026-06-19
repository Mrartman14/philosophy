// src/features/users/errors.ts
import "server-only";
import {
  rethrowApiError,
  type ApiError,
  type ApiErrorMessageKeys,
} from "@/utils/api-error";

/** Алиас общего {@link ApiError} — `code` типизирован сгенерированным
 * union `apperror.Code` (источник истины — `internal/apperror/codes.go`). */
export type UserApiError = ApiError;

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
 * Переводит ошибку бекенда в throw с понятным текстом.
 * ForbiddenError ловится createAction → { success: false, code: "forbidden" },
 * клиент показывает branded-текст «У вас нет прав на …».
 *
 * CONFLICT с под-маппингом по message обрабатывается локально (общая карта
 * умеет только code→текст), остальное делегируется в {@link rethrowApiError}.
 */
export function rethrowUserApiError(err: UserApiError | undefined): never {
  if (err?.code === "CONFLICT") {
    const friendly = err.error ? CONFLICT_MESSAGES[err.error] : undefined;
    throw new Error(friendly ?? "Операция отклонена сервером (конфликт).");
  }
  rethrowApiError(err, ERRORS);
}
