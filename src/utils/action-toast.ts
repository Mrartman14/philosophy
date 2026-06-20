import type { ErrorsT } from "@/i18n/client";

import { actionErrorMessage } from "./action-message";
import type { ActionResult } from "./create-action";

interface ToastManager {
  add: (opts: { title?: string; description?: string }) => void;
}

interface ToastActionErrorOpts {
  /** Уже-локализованное действие в родительном падеже (напр. `t("deleteAction")`). */
  action: string;
  /** Переопределение заголовка forbidden-тоста (по умолчанию `errors.forbiddenTitle`). */
  forbiddenTitle?: string;
  /** Переопределение заголовка тоста ошибки (по умолчанию `errors.failureTitle`). */
  failureTitle?: string;
}

/**
 * Shows a single toast for a failed ActionResult.
 *
 * Локализация: вызыватель (client) прокидывает `tErrors = useT("errors")`. Шаблон
 * и заголовки по умолчанию резолвятся из namespace `errors`; `opts.forbiddenTitle`
 * / `opts.failureTitle` переопределяют их уже-локализованной строкой.
 */
export function toastActionError(
  toast: ToastManager,
  tErrors: ErrorsT,
  result: Extract<ActionResult<unknown>, { success: false }>,
  opts: ToastActionErrorOpts,
): void {
  if (result.code === "forbidden") {
    toast.add({
      title: opts.forbiddenTitle ?? tErrors("forbiddenTitle"),
      description: actionErrorMessage(tErrors, result, opts.action),
    });
  } else {
    toast.add({
      title: opts.failureTitle ?? tErrors("failureTitle"),
      description: result.error,
    });
  }
}
