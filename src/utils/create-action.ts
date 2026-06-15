/**
 * Обёртка для server actions.
 *
 * Пробрасывает специальные ошибки Next.js (redirect(), notFound(), forbidden(),
 * unauthorized()), чтобы Next.js смог их обработать. Для ForbiddenError из
 * `src/utils/permissions.ts` возвращает `{ success: false, code: "forbidden" }`.
 * Остальные ошибки превращаются в ActionResult с `success: false`.
 */

import { z, type ZodType } from "zod";

import { ForbiddenError } from "./permissions";
import { readIdempotencyKey } from "./idempotency";

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

function toResult<T>(error: unknown): ActionResult<T> {
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
  const message =
    error instanceof Error ? error.message : "Неизвестная ошибка";
  return { success: false, error: message };
}

export function createAction<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    try {
      const data = await fn(input);
      return { success: true, data };
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      return toResult<TOutput>(error);
    }
  };
}

/** Контекст, который `createFormAction` прокидывает обработчику вторым
 * аргументом. Существующие обработчики `(formData) => …` его игнорируют
 * (функция, принимающая меньше аргументов, совместима по типу). */
export interface FormActionContext {
  /** Ключ идемпотентности из скрытого поля формы (или `undefined`). */
  idempotencyKey: string | undefined;
}

export function createFormAction<TOutput>(
  fn: (formData: FormData, ctx: FormActionContext) => Promise<TOutput>
): (
  prevState: ActionResult<TOutput>,
  formData: FormData
) => Promise<ActionResult<TOutput>> {
  return async (_prevState: ActionResult<TOutput>, formData: FormData) => {
    try {
      const ctx: FormActionContext = {
        idempotencyKey: readIdempotencyKey(formData),
      };
      const data = await fn(formData, ctx);
      return { success: true, data };
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      return toResult<TOutput>(error);
    }
  };
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
