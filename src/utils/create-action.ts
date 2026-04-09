/**
 * Обёртка для server actions.
 *
 * Пробрасывает специальные ошибки Next.js (redirect(), notFound(), forbidden(),
 * unauthorized()), чтобы Next.js смог их обработать. Для ForbiddenError из
 * `src/utils/permissions.ts` возвращает `{ success: false, code: "forbidden" }`.
 * Остальные ошибки превращаются в ActionResult с `success: false`.
 */

import { ForbiddenError } from "./permissions";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      code?: "forbidden";
    };

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

export function createFormAction<TOutput>(
  fn: (formData: FormData) => Promise<TOutput>
): (
  prevState: ActionResult<TOutput>,
  formData: FormData
) => Promise<ActionResult<TOutput>> {
  return async (_prevState: ActionResult<TOutput>, formData: FormData) => {
    try {
      const data = await fn(formData);
      return { success: true, data };
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      return toResult<TOutput>(error);
    }
  };
}
