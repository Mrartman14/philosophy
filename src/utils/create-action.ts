/**
 * Обёртка для server actions.
 *
 * Пробрасывает специальные ошибки Next.js (redirect(), notFound(), forbidden(),
 * unauthorized()), чтобы Next.js смог их обработать. Для ForbiddenError из
 * `src/utils/permissions.ts` возвращает `{ success: false, code: "forbidden" }`.
 * Остальные ошибки превращаются в ActionResult с `success: false`.
 */

import { redirect } from "next/navigation";
import { z, type ZodType } from "zod";

import { type ErrorKey, resolveErrorMessage } from "@/i18n";
import { errors, metrics, M, classifyError } from "@/services/observability";

import { readIdempotencyKey } from "./idempotency";
import { BannedError, ForbiddenError } from "./permissions";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code: "forbidden" }
  | {
      success: false;
      error: string;
      code: "validation";
      fieldErrors: Record<string, string>;
    }
  | { success: false; error: string; code?: undefined };

/** Проверяет, является ли ошибка специальной ошибкой Next.js. */
function isNextInternalError(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("digest" in error) ||
    typeof (error as { digest: unknown }).digest !== "string"
  ) {
    return false;
  }
  const digest = (error as { digest: string }).digest;
  return (
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}

async function toResult<T>(error: unknown): Promise<ActionResult<T>> {
  if (error instanceof ForbiddenError) {
    return { success: false, error: error.message, code: "forbidden" };
  }
  if (error instanceof ZodValidationError) {
    return {
      success: false,
      error: error.message,
      code: "validation",
      fieldErrors: error.fieldErrors,
    };
  }
  // Локализуемая ошибка бека: несёт ключ namespace «errors», а не готовый текст.
  // Единственная точка перевода api-error/доменных кодов (Guardrail 5: getT
  // живёт в фасаде @/i18n, не в server-only api-error). Локаль — из request-scope.
  if (error instanceof ApiMessageError) {
    return {
      success: false,
      error: await resolveErrorMessage(error.messageKey, error.params),
    };
  }
  const message =
    error instanceof Error ? error.message : "Неизвестная ошибка";
  return { success: false, error: message };
}

/** Контекст, который `createAction` / `createFormAction` прокидывают обработчику
 * вторым аргументом. Существующие обработчики `(input) => …` его игнорируют
 * (функция, принимающая меньше аргументов, совместима по типу). */
export interface FormActionContext {
  /** Ключ идемпотентности из аргумента вызова или скрытого поля формы (или `undefined`). */
  idempotencyKey: string | undefined;
}

/** Инструментирует ветку catch: re-throw Next-внутренних ошибок, capture
 * остальных с классификацией. Возвращает outcome-строку для action.completed.
 * Контроль-флоу повторяет исходный: Banned → redirect, Next-internal → throw. */
function captureActionError(error: unknown, name: string): string {
  if (error instanceof BannedError) {
    errors.capture(error, { errorClass: "banned", handled: true, attributes: { action: name } });
    redirect("/auth/forced-logout");
  }
  if (isNextInternalError(error)) throw error;
  const { errorClass, backendCode } = classifyError(error);
  errors.capture(error, {
    errorClass,
    ...(backendCode !== null ? { backendCode } : {}),
    handled: true,
    attributes: { action: name },
  });
  return errorClass;
}

export function createAction<TInput, TOutput>(
  fn: (input: TInput, ctx: FormActionContext) => Promise<TOutput>,
  name = "anonymous"
): (input: TInput, idempotencyKey?: string) => Promise<ActionResult<TOutput>> {
  return async (input: TInput, idempotencyKey?: string) => {
    const end = metrics.startTimer(M.actionDuration, { action: name });
    try {
      const data = await fn(input, { idempotencyKey });
      metrics.increment(M.actionCompleted, { action: name, outcome: "success" });
      return { success: true, data };
    } catch (error) {
      const outcome = captureActionError(error, name);
      metrics.increment(M.actionCompleted, { action: name, outcome });
      return await toResult<TOutput>(error);
    } finally {
      end();
    }
  };
}

export function createFormAction<TOutput>(
  fn: (formData: FormData, ctx: FormActionContext) => Promise<TOutput>,
  name = "anonymous"
): (
  prevState: ActionResult<TOutput>,
  formData: FormData
) => Promise<ActionResult<TOutput>> {
  return async (_prevState: ActionResult<TOutput>, formData: FormData) => {
    const end = metrics.startTimer(M.actionDuration, { action: name });
    try {
      const ctx: FormActionContext = {
        idempotencyKey: readIdempotencyKey(formData),
      };
      const data = await fn(formData, ctx);
      metrics.increment(M.actionCompleted, { action: name, outcome: "success" });
      return { success: true, data };
    } catch (error) {
      const outcome = captureActionError(error, name);
      metrics.increment(M.actionCompleted, { action: name, outcome });
      return await toResult<TOutput>(error);
    } finally {
      end();
    }
  };
}

/**
 * Локализуемая ошибка бека: несёт КЛЮЧ namespace «errors» (+ ICU-параметры),
 * а не готовый русский текст. Бросается из `rethrowApiError` для маппленных
 * доменных кодов; `createAction`/`createFormAction` резолвят ключ в текст ОДИН
 * раз на границе (`toResult` → `resolveErrorMessage`). Это держит server-only
 * `api-error.ts` синхронным и свободным от прямого импорта next-intl
 * (Guardrail 5): перевод инкапсулирован в фасаде `@/i18n`.
 */
export class ApiMessageError extends Error {
  constructor(
    public readonly messageKey: ErrorKey,
    public readonly params?: Record<string, string | number>,
  ) {
    super(messageKey);
    this.name = "ApiMessageError";
  }
}

/**
 * Бросается из `parseFormData`, когда `FormData` не прошла Zod-валидацию.
 * `createFormAction` ловит её и возвращает
 * `{ success: false, code: "validation", error, fieldErrors }`.
 */
export class ZodValidationError extends Error {
  readonly code = "validation" as const;
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Ошибка валидации");
    this.name = "ZodValidationError";
  }
}

/**
 * Парсит `FormData` через Zod-схему. При успехе — возвращает типизированный
 * объект. При неуспехе — бросает `ZodValidationError`, у которого
 * `fieldErrors[name]` = первое сообщение об ошибке для каждого поля.
 *
 * Преобразует `FormData` в plain-object через `Object.fromEntries(fd.entries())`.
 * Для multi-value полей (множественный select, checkbox-group) используйте
 * `z.array(z.string())` в схеме и кастомное преобразование, не покрывается этим
 * хелпером.
 *
 * Cross-field ошибки (из `.refine()` / `.superRefine()` с пустым `path`)
 * попадают под ключ `"_form"`.
 */
export function parseFormData<T extends ZodType>(
  schema: T,
  formData: FormData
): z.infer<T> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length === 0 ? "_form" : issue.path.join(".");
    fieldErrors[key] ??= issue.message;
  }
  throw new ZodValidationError(fieldErrors);
}
