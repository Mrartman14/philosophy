"use client";
// src/components/ui/tooltip.tsx
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { type ReactElement, type ReactNode } from "react";

import { cn, OVERLAY_LAYER } from "./cn";

export interface TooltipProps {
  /** Контент подсказки. Если пусто/нет — триггер рендерится без тултипа. */
  content: ReactNode;
  /**
   * Единственный элемент-триггер (обычно кнопка). Через `render`-проп Base UI
   * подмешивает на него свои пропсы — элемент обязан форвардить ref и `...rest`
   * (kit-кнопки это делают).
   */
  children: ReactElement;
  /** Сторона появления относительно триггера. По умолчанию сверху. */
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Compound-обёртка над Base UI Tooltip. Удобный фасад: `children` становится
 * триггером, попап несёт инверсный surface-стиль (fg-фон / surface-текст).
 *
 * ВАЖНО: подсказка — это ОПИСАНИЕ (aria-describedby), а не доступное имя. У
 * иконочного триггера всё равно обязателен `aria-label` — тултип его не заменяет.
 *
 * `Tooltip.Provider` даёт сгруппированную задержку наведения для ряда кнопок
 * (тулбар): первый показ ждёт `delay`, соседние — мгновенно.
 */
function TooltipBase({ content, children, side = "top" }: TooltipProps): ReactElement {
  if (content == null || content === "") return children;
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        {/* OVERLAY_LAYER — z-index на Positioner, чтобы оверлей был над sticky-
            хедером (см. подробности в cn.ts). Без него Positioner = auto(0). */}
        <BaseTooltip.Positioner side={side} sideOffset={6} className={OVERLAY_LAYER}>
          <BaseTooltip.Popup
            className={cn(
              "select-none rounded bg-(--color-fg) px-2 py-1 text-xs font-medium text-(--color-surface) shadow-md",
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export const Tooltip = Object.assign(TooltipBase, {
  Provider: BaseTooltip.Provider,
});
