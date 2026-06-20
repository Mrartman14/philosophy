import type { ErrorsT } from "@/i18n/client";

import type { ActionResult } from "./create-action";

/**
 * Branded message for a failed action: forbidden → локализованный
 * «У вас нет прав на <action>.»; иначе серверная ошибка.
 *
 * Локализация: вызыватель (client) прокидывает `tErrors = useT("errors")` и
 * УЖЕ-локализованное `action` (родительный падеж, напр. `t("deleteAction")`).
 * Утилита остаётся синхронной и без хуков (Guardrail 5 — тип `ErrorsT` импортится
 * из client-фасада, не из next-intl).
 */
export function actionErrorMessage(
  tErrors: ErrorsT,
  result: Extract<ActionResult<unknown>, { success: false }>,
  action: string,
): string {
  if (result.code === "forbidden") return tErrors("forbiddenAction", { action });
  return result.error;
}
