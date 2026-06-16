import { actionErrorMessage } from "./action-message";
import type { ActionResult } from "./create-action";

interface ToastManager {
  add: (opts: { title?: string; description?: string }) => void;
}

interface ToastActionErrorOpts {
  action: string;
  forbiddenTitle?: string;
  failureTitle?: string;
}

/** Shows a single toast for a failed ActionResult. */
export function toastActionError(
  toast: ToastManager,
  result: Extract<ActionResult<unknown>, { success: false }>,
  opts: ToastActionErrorOpts,
): void {
  if (result.code === "forbidden") {
    toast.add({
      title: opts.forbiddenTitle ?? "Нет прав",
      description: actionErrorMessage(result, opts.action),
    });
  } else {
    toast.add({
      title: opts.failureTitle ?? "Ошибка",
      description: result.error,
    });
  }
}
