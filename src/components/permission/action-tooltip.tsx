"use client";

import type { ReactNode } from "react";

import { useT } from "@/i18n/client";
import type { DenyReason } from "@/utils/permissions";

interface ActionTooltipProps {
  /**
   * Причина запрета. `null` — действие разрешено, child рендерится без обёртки.
   * `role` / `owner` сюда не должны доходить — они скрываются полностью.
   */
  reason: DenyReason | null;
  /**
   * Человекочитаемое название действия для текста tooltip'а («поставить лайк»,
   * «оставить комментарий»).
   */
  action: string;
  children: ReactNode;
}

/**
 * Универсальная обёртка для disabled-кнопок с пояснением.
 *
 * При `reason !== null` оборачивает child в `<span>` с `title` и
 * `aria-disabled` — это работает с любым child'ом (нативный `<button>`,
 * кастомный `<ReactionButton>` и т.п.) без зависимости от того, какие
 * пропсы child принимает. Для отключения интерактивности child должен сам
 * получить `disabled` от вызывающего кода.
 */
export const ActionTooltip: React.FC<ActionTooltipProps> = ({
  reason,
  action,
  children,
}) => {
  const t = useT("common");

  if (reason === null) return children;

  let text: string;
  switch (reason) {
    case "guest":
      text = t("actionTooltip.loginToAction", { action });
      break;
    case "status":
      text = t("actionTooltip.accountRestrictedAction", { action });
      break;
    case "role":
    case "owner":
      // Не должно случаться: эти reason'ы рендерятся как «полностью скрыто».
      text = t("actionTooltip.actionUnavailable");
      break;
  }

  return (
    <span
      title={text}
      aria-disabled="true"
      // pointer-events: none на span ломает клик по детям — оставляем default.
      className="inline-flex"
    >
      {children}
    </span>
  );
};
