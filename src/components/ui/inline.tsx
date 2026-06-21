// src/components/ui/inline.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

export const INLINE_CLASS = "flex flex-row flex-wrap gap-(--space-stack)";

const alignClass = {
  center: "items-center",
  end: "items-end",
  start: "items-start",
} as const;

export interface InlineProps {
  /** Вертикальное выравнивание ряда (default center). */
  align?: keyof typeof alignClass;
  /**
   * Плотность ряда. `default` — density-токен (`--space-stack`, для рядов
   * фильтров/кнопок). `tight` — `gap-2` для тесной пары «контрол + его подпись»
   * (чекбокс/радио + Label), где широкий gap визуально отрывает подпись.
   */
  gap?: "default" | "tight";
  className?: string;
  children: ReactNode;
}

/**
 * Горизонтальный layout-примитив kit: ряд с переносом, density-aware gap.
 * Structural — className ОТКРЫТ. Поглощает горизонтальные формы, ряды
 * фильтров/кнопок, выравнивание одиночной кнопки в форме.
 */
export function Inline({ align = "center", gap = "default", className, children }: InlineProps) {
  // gap="tight" → twMerge перебивает базовый gap-(--space-stack) на gap-2.
  return (
    <div className={cn(INLINE_CLASS, gap === "tight" && "gap-2", alignClass[align], className)}>
      {children}
    </div>
  );
}
