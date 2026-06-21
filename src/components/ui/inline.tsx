// src/components/ui/inline.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

export const INLINE_CLASS = "flex flex-row flex-wrap";

const alignClass = {
  center: "items-center",
  end: "items-end",
  start: "items-start",
} as const;

const gapClass = {
  default: "gap-(--space-stack)",
  tight: "gap-2",
} as const;

export interface InlineProps {
  /** Вертикальное выравнивание ряда (default center). */
  align?: keyof typeof alignClass;
  /**
   * Плотность ряда. `default` — density-токен (`--space-stack`, для рядов
   * фильтров/кнопок). `tight` — `gap-2` для тесной пары «контрол + его подпись»
   * (чекбокс/радио + Label), где широкий gap визуально отрывает подпись.
   */
  gap?: keyof typeof gapClass;
  className?: string;
  children: ReactNode;
}

/**
 * Горизонтальный layout-примитив kit: ряд с переносом, density-aware gap.
 * Structural — className ОТКРЫТ. Поглощает горизонтальные формы, ряды
 * фильтров/кнопок, выравнивание одиночной кнопки в форме.
 */
export function Inline({ align = "center", gap = "default", className, children }: InlineProps) {
  return (
    <div className={cn(INLINE_CLASS, gapClass[gap], alignClass[align], className)}>
      {children}
    </div>
  );
}
