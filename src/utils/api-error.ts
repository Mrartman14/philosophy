import "server-only";
import type { ApiErrorCode } from "@/api/types";
import type { ErrorKey } from "@/i18n";
// Чистый объект каталога (без next-intl) — для runtime-проверки «значение карты
// = ключ каталога?». Импорт типа `ErrorKey` выше + это значение держат api-error
// синхронным и свободным от прямого next-intl (Guardrail 5).
import ruErrors from "@/i18n/messages/ru/errors";
import { errors, metrics, M } from "@/services/observability";

import { ApiMessageError, ZodValidationError } from "./create-action";
import { BannedError, ForbiddenError } from "./permissions";

/** True, если значение override-карты — ключ namespace `errors` (новый
 * локализуемый канал), а не легаси-текст. Коды каталога — SCREAMING_CASE/camelCase,
 * легаси-значения — русские предложения, поэтому коллизий нет. */
function isErrorKey(value: string): value is ErrorKey {
  return Object.prototype.hasOwnProperty.call(ruErrors, value);
}

/** Форма ошибки бека (openapi-fetch error body / ручной JSON). `code`
 * типизирован сгенерированным union `apperror.Code` — опечатка в ключе
 * `overrides`/`DEFAULT_MESSAGES` или удалённый на беке код краснеют после
 * regen `schema.ts`. */
export interface ApiError {
  code?: ApiErrorCode;
  error?: string;
  /** Карта «поле → текст» из httputil.ValidationErrorResponse (422). */
  fields?: Record<string, string>;
}

/** Карта override-ов слайса «доменный код → ГОТОВЫЙ текст». ЛЕГАСИ-канал на
 * время постепенной i18n-миграции: значение — литерал, `rethrowApiError`
 * бросает `Error(text)`. `Partial<Record<ApiErrorCode>>` сохраняет детект
 * дрифта: переименованный/удалённый на беке код подсветится в `tsc`.
 *
 * НОВЫЙ канал (целевой) — {@link ApiErrorMessageKeys}: значение = ключ каталога
 * `errors`, `rethrowApiError` бросает `ApiMessageError(key)` (локализуемо).
 * Слайс мигрирует свою карту `string → ErrorKey`, переключив тип на
 * `ApiErrorMessageKeys` и добавив ключи в `src/i18n/messages/{ru,en}/errors.ts`. */
export type ApiErrorMessages = Partial<Record<ApiErrorCode, string>>;

/** Локализуемый аналог {@link ApiErrorMessages}: значение — ключ namespace
 * `errors` (`ErrorKey`), не текст. Используется `DEFAULT_MESSAGES` и слайсами,
 * мигрированными на i18n. Двойная защита от дрифта в `tsc`: код бека (ключ
 * записи) И существование ключа каталога (значение). */
export type ApiErrorMessageKeys = Partial<Record<ApiErrorCode, ErrorKey>>;

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

/** Базовые маппинги «доменный код → ключ каталога `errors`» с каноничной
 * формулировкой в большинстве слайсов. Слайс переопределяет любой код через
 * `overrides` (entity-специфичный ключ), а новый общий код добавляется сюда
 * ОДНОЙ строкой вместо копипасты по слайсам. Значение — ключ namespace `errors`
 * (ru/errors.ts + en/errors.ts), НЕ текст. */
const DEFAULT_MESSAGES: ApiErrorMessageKeys = {
  REF_NOT_FOUND: "REF_NOT_FOUND",
  BLOCKS_HAVE_ANCHORS: "BLOCKS_HAVE_ANCHORS",
  // Optimistic locking (If-Match/version) — общие для всех lock-protected
  // сущностей (optlock-волны 1+2: canvas/comment/document/glossary +
  // annotation/event/banner). 412 = чужая правка обогнала, 428 = клиент не
  // приложил версию (не должно случаться — формы шлют hidden version; защитный
  // дефолт). Слайс может переопределить entity-ключом.
  VERSION_MISMATCH: "VERSION_MISMATCH",
  IF_MATCH_REQUIRED: "IF_MATCH_REQUIRED",
  IDEMPOTENCY_KEY_IN_USE: "IDEMPOTENCY_KEY_IN_USE",
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
  IDEMPOTENCY_KEY_INVALID: "IDEMPOTENCY_KEY_INVALID",
  // 413 — общий дефолт для всех ручек с лимитом тела (создание комментария,
  // поиск/контекст и др.). Слайс может переопределить entity-ключом
  // (canvas → CANVAS_PAYLOAD_TOO_LARGE, annotation → ANNOTATION_REQUEST_BODY_TOO_LARGE).
  REQUEST_BODY_TOO_LARGE: "REQUEST_BODY_TOO_LARGE",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
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
 * 4. `overrides[code]` слайса → дефолт `DEFAULT_MESSAGES[code]`. Значение-ключ
 *    каталога (`errors`) → `ApiMessageError(key)` (createAction локализует);
 *    легаси-значение-текст → `Error(text)` (до миграции слайса).
 * 5. фоллбек: `Error(err.error)` (текст бека) или `ApiMessageError("serverError")`.
 *
 * Целевой (i18n) канал — карта code→ключ каталога `errors` типа
 * {@link ApiErrorMessageKeys}; ключи добавляются в `src/i18n/messages/{ru,en}/errors.ts`:
 *
 * ```ts
 * const ERRORS: ApiErrorMessageKeys = {
 *   INVALID_DATE: "INVALID_DATE", // ключ из ru/errors.ts + en/errors.ts
 *   // REF_NOT_FOUND / BLOCKS_HAVE_ANCHORS — из DEFAULT_MESSAGES
 * };
 * if (error) rethrowApiError(error, ERRORS);
 * ```
 *
 * Легаси-канал (до миграции слайса) — карта code→текст типа
 * {@link ApiErrorMessages}; `rethrowApiError` бросает её значения как `Error(text)`.
 */
export function rethrowApiError(
  err: ApiError | undefined,
  overrides?: ApiErrorMessages | ApiErrorMessageKeys,
): never {
  const code = err?.code;
  if (code) {
    // Метрика по доменному коду — до любого throw, чтобы попадали все ветки.
    metrics.increment(M.backendError, { code });

    // 1. Форс-логаут: BANNED имеет наивысший приоритет — даже при наличии fields
    //    (дрейф контракта) забаненный должен быть разлогинен, а не получить
    //    field-ошибку.
    if (code === "BANNED") {
      throw new BannedError(err.error ?? "Account banned");
    }

    // 2. Role-403: нет прав на операцию.
    if (ROLE_FORBIDDEN_CODES.has(code)) {
      throw new ForbiddenError("role", err.error);
    }

    // 3. Status-403: аккаунт ограничен (SUSPENDED). Текст бека приоритетнее;
    //    иначе клиент рисует branded `errors.accountRestricted` (Case 3) —
    //    сообщение НЕ бакается здесь, чтобы остаться локализуемым.
    if (STATUS_FORBIDDEN_CODES.has(code)) {
      throw new ForbiddenError("status", err.error);
    }

    // 4. Серверная валидация (422): раскладка по полям имеет приоритет над общим
    //    текстом, чтобы попасть в канал {code:"validation", fieldErrors}.
    //    Стоит ПОСЛЕ auth/forbidden-веток: если бек вдруг пришлёт fields+BANNED,
    //    форс-логаут (п.1) сработает раньше.
    if (err.fields && Object.keys(err.fields).length > 0) {
      throw new ZodValidationError(err.fields);
    }

    // 5. Маппинг кода: слайс-override → дефолт. Значение-ключ каталога →
    //    ApiMessageError(key) (локализуется в toResult); легаси-текст → Error(text).
    const mapped = overrides?.[code] ?? DEFAULT_MESSAGES[code];
    if (mapped) {
      throw isErrorKey(mapped)
        ? new ApiMessageError(mapped)
        : new Error(mapped);
    }

    // Код есть, но нигде не сопоставлен — это дрифт контракта, не юзер-ошибка.
    errors.capture(new Error(err.error ?? `Unmapped backend code: ${code}`), {
      errorClass: "unexpected",
      backendCode: code,
      handled: true,
      attributes: { reason: "unmapped_backend_code" },
    });
  }
  // Фоллбек: текст бека приоритетнее (уже на языке ответа); иначе
  // локализуемый ключ serverError, резолвится в createAction.
  if (err?.error) throw new Error(err.error);
  throw new ApiMessageError("serverError");
}
