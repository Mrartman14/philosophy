"use client";

import type { ReactNode } from "react";
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

function tooltipText(reason: DenyReason, action: string): string {
  switch (reason) {
    case "guest":
      return `Войдите, чтобы ${action}`;
    case "status":
      return `Аккаунт ограничен — нельзя ${action}`;
    case "role":
    case "owner":
      // Не должно случаться: эти reason'ы рендерятся как «полностью скрыто».
      return `Действие недоступно`;
  }
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
  if (reason === null) return children;
  const text = tooltipText(reason, action);
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
