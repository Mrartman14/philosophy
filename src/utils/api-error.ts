import "server-only";
import type { ApiErrorCode } from "@/api/types";

import { ForbiddenError } from "./permissions";

/** Форма ошибки бека (openapi-fetch error body / ручной JSON). `code`
 * типизирован сгенерированным union `apperror.Code` — опечатка в ключе
 * `overrides`/`DEFAULT_MESSAGES` или удалённый на беке код краснеют после
 * regen `schema.ts`. */
export interface ApiError {
  code?: ApiErrorCode;
  error?: string;
}

/** Карта «доменный код → русский текст». Используется и для дефолтов, и для
 * локальных override-ов слайса. `Partial<Record<ApiErrorCode>>` сохраняет
 * детект дрифта: переименованный/удалённый на беке код подсветится в `tsc`. */
export type ApiErrorMessages = Partial<Record<ApiErrorCode, string>>;

/** Доменные коды-403: на фронте это «нет прав» → `ForbiddenError("role")`.
 * `createAction` превращает в `{ code: "forbidden" }`, UI рисует branded-текст
 * «У вас нет прав на …». Слайсам НЕ нужно их перечислять. */
const ROLE_FORBIDDEN_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "FORBIDDEN",
  "ATTACH_FORBIDDEN",
  "UPLOAD_FOREIGN",
]);

/** Коды ограничения аккаунта → `ForbiddenError("status")` (branded-ветка
 * «Аккаунт ограничен»). Централизованы здесь, чтобы слайсы не дублировали
 * SUSPENDED/BANNED и не расходились (раньше часть слайсов бросала обычный
 * `Error`, теряя `code: "forbidden"`). */
const STATUS_FORBIDDEN_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "SUSPENDED",
  "BANNED",
]);

/** Базовые тексты для доменных кодов с каноничной формулировкой в большинстве
 * слайсов. Слайс переопределяет любой код через `overrides` (entity-специфичный
 * текст), а новый общий код добавляется сюда ОДНОЙ строкой вместо копипасты по
 * слайсам. */
const DEFAULT_MESSAGES: ApiErrorMessages = {
  REF_NOT_FOUND: "Одна из ссылок указывает на несуществующий объект.",
  BLOCKS_HAVE_ANCHORS:
    "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок.",
  IDEMPOTENCY_KEY_IN_USE:
    "Запрос уже обрабатывается. Подождите, не отправляйте повторно.",
  IDEMPOTENCY_KEY_REUSED:
    "Изменённый запрос конфликтует с уже отправленным. Обновите страницу.",
  IDEMPOTENCY_KEY_INVALID:
    "Некорректный ключ идемпотентности. Обновите страницу и повторите.",
};

/**
 * Единая точка маппинга кода ошибки бека в throw. Никогда не возвращает.
 *
 * Порядок разрешения:
 * 1. role-403 коды (`FORBIDDEN`/`ATTACH_FORBIDDEN`/`UPLOAD_FOREIGN`) →
 *    `ForbiddenError("role")`.
 * 2. account-коды (`SUSPENDED`/`BANNED`) → `ForbiddenError("status")`.
 * 3. `overrides[code]` слайса → дефолт `DEFAULT_MESSAGES[code]` → `Error(text)`.
 * 4. фоллбек: `Error(err.error ?? "Ошибка сервера")`.
 *
 * Слайс описывает только свои доменные коды декларативной картой:
 *
 * ```ts
 * const ERRORS: ApiErrorMessages = {
 *   INVALID_DATE: "Бекенд отклонил дату…",
 *   // REF_NOT_FOUND / BLOCKS_HAVE_ANCHORS — из DEFAULT_MESSAGES
 * };
 * if (error) rethrowApiError(error, ERRORS);
 * ```
 */
export function rethrowApiError(
  err: ApiError | undefined,
  overrides?: ApiErrorMessages,
): never {
  const code = err?.code;
  if (code) {
    if (ROLE_FORBIDDEN_CODES.has(code)) {
      throw new ForbiddenError("role", err.error);
    }
    if (STATUS_FORBIDDEN_CODES.has(code)) {
      throw new ForbiddenError("status", err.error ?? "Аккаунт ограничен.");
    }
    const text = overrides?.[code] ?? DEFAULT_MESSAGES[code];
    if (text) throw new Error(text);
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}
