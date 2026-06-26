"use client";
// src/components/ui/tooltip.tsx
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { type ReactElement, type ReactNode } from "react";

import { cn } from "./cn";

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
        {/* z-index на Positioner (это и есть позиционируемый fixed-элемент).
            Портал монтируется в конец <body> — ПОСЛЕ sticky-хедера, который сидит
            на литеральном z-50 (= слой `--z-toast`). На равном z-index порядок
            рисовки решает DOM-порядок, поэтому портал ложится ПОВЕРХ хедера — тем
            же механизмом, что и тостер (toaster.tsx, тоже z-50 над тем же хедером).
            Без явного z-index Positioner наследовал бы auto(0) и прятался под хедер. */}
        <BaseTooltip.Positioner side={side} sideOffset={6} className="z-[var(--z-toast)]">
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
