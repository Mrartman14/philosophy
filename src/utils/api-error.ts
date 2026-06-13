import "server-only";
import type { ApiErrorCode } from "@/api/types";
import { ForbiddenError } from "./permissions";

/** Форма ошибки бека (openapi-fetch error body / ручной JSON). `code`
 * типизирован сгенерированным union `apperror.Code` — опечатка в `case`
 * или удалённый на беке код краснеют после regen `schema.ts`. */
export type ApiError = { code?: ApiErrorCode; error?: string };

/**
 * Обрабатывает ОБЩИЕ коды ошибок бека (`FORBIDDEN`/`SUSPENDED`) и неизвестные
 * коды (fallback). Доменные коды слайс маппит в своём `switch` ДО вызова этой
 * функции — она вызывается последней и никогда не возвращает:
 *
 * ```ts
 * function rethrowApiError(err: ApiError | undefined): never {
 *   switch (err?.code) {
 *     case "SELF_REACTION": throw new Error("…");
 *   }
 *   handleCommonApiError(err);
 * }
 * ```
 *
 * Слайс с особым текстом для `FORBIDDEN`/`SUSPENDED` оставляет свой `case`
 * локально (он отработает раньше).
 */
export function handleCommonApiError(
  err: ApiError | undefined,
  fallback = "Ошибка сервера",
): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error ?? "Аккаунт ограничен.");
    default:
      throw new Error(err?.error ?? fallback);
  }
}
