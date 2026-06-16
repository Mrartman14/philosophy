import type { ActionResult } from "./create-action";

/** Branded message for a failed action: forbidden → «У вас нет прав на <action>.»; else the server error. */
export function actionErrorMessage(
  result: Extract<ActionResult<unknown>, { success: false }>,
  action: string,
): string {
  if (result.code === "forbidden") return `У вас нет прав на ${action}.`;
  return result.error;
}
