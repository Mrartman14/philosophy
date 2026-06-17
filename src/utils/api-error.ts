import "server-only";
import type { ApiErrorCode } from "@/api/types";
import { errors, metrics, M } from "@/services/observability";

import { BannedError, ForbiddenError } from "./permissions";

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
 * «Аккаунт ограничен»). Только `SUSPENDED`: `BANNED` обрабатывается выше
 * отдельной веткой как `BannedError` (форс-логаут). Централизованы здесь, чтобы
 * слайсы не дублировали и не расходились (раньше часть слайсов бросала обычный
 * `Error`, теряя `code: "forbidden"`). */
const STATUS_FORBIDDEN_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "SUSPENDED",
]);

/** Базовые тексты для доменных кодов с каноничной формулировкой в большинстве
 * слайсов. Слайс переопределяет любой код через `overrides` (entity-специфичный
 * текст), а новый общий код добавляется сюда ОДНОЙ строкой вместо копипасты по
 * слайсам. */
const DEFAULT_MESSAGES: ApiErrorMessages = {
  REF_NOT_FOUND: "Одна из ссылок указывает на несуществующий объект.",
  BLOCKS_HAVE_ANCHORS:
    "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок.",
  // Optimistic locking (If-Match/version) — общие для всех lock-protected
  // сущностей (optlock-волны 1+2: canvas/comment/document/glossary +
  // annotation/event/banner). 412 = чужая правка обогнала, 428 = клиент не
  // приложил версию (не должно случаться — формы шлют hidden version; защитный
  // дефолт). Слайс может переопределить entity-текстом.
  VERSION_MISMATCH:
    "Объект изменён в другом месте. Обновите страницу и повторите.",
  IF_MATCH_REQUIRED:
    "Не удалось определить версию объекта. Обновите страницу и повторите.",
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
 * 1. `BANNED` → `BannedError` (сигнал форс-логаута, ловится в createAction →
 *    `redirect("/auth/forced-logout")`).
 * 2. role-403 коды (`FORBIDDEN`/`ATTACH_FORBIDDEN`/`UPLOAD_FOREIGN`) →
 *    `ForbiddenError("role")`.
 * 3. account-код `SUSPENDED` → `ForbiddenError("status")`.
 * 4. `overrides[code]` слайса → дефолт `DEFAULT_MESSAGES[code]` → `Error(text)`.
 * 5. фоллбек: `Error(err.error ?? "Ошибка сервера")`.
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
    // Метрика по доменному коду — до любого throw, чтобы попадали все ветки.
    metrics.increment(M.backendError, { code });
    if (code === "BANNED") {
      throw new BannedError(err.error ?? "Account banned");
    }
    if (ROLE_FORBIDDEN_CODES.has(code)) {
      throw new ForbiddenError("role", err.error);
    }
    if (STATUS_FORBIDDEN_CODES.has(code)) {
      throw new ForbiddenError("status", err.error ?? "Аккаунт ограничен.");
    }
    const text = overrides?.[code] ?? DEFAULT_MESSAGES[code];
    if (text) throw new Error(text);
    // Код есть, но нигде не сопоставлен — это дрифт контракта, не юзер-ошибка.
    errors.capture(new Error(err.error ?? `Unmapped backend code: ${code}`), {
      errorClass: "unexpected",
      backendCode: code,
      handled: true,
      attributes: { reason: "unmapped_backend_code" },
    });
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}
