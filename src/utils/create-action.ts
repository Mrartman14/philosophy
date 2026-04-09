/**
 * Обёртка для server actions.
 *
 * Пробрасывает специальные ошибки Next.js (redirect(), notFound(), forbidden(), unauthorized()),
 * чтобы Next.js смог их обработать. Остальные ошибки превращаются в ActionResult с `success: false`.
 *
 * Проверка идёт по `digest`-строке — чтобы не зависеть от непубличных модулей Next.js.
 */

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Проверяет, является ли ошибка специальной ошибкой Next.js (redirect / notFound / forbidden / unauthorized). */
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

/**
 * Обёртка для прямых вызовов server actions.
 * Принимает один аргумент, возвращает `ActionResult<T>`.
 */
export function createAction<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    try {
      const data = await fn(input);
      return { success: true, data };
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      // TODO: логирование
      return { success: false, error: message };
    }
  };
}

/**
 * Вариант для form actions, совместимый с `useActionState`.
 * Принимает `(prevState, formData)`, возвращает `ActionResult<T>`.
 */
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
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      return { success: false, error: message };
    }
  };
}
