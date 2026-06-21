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
  className?: string;
  children: ReactNode;
}

/**
 * Горизонтальный layout-примитив kit: ряд с переносом, density-aware gap.
 * Structural — className ОТКРЫТ. Поглощает горизонтальные формы, ряды
 * фильтров/кнопок, выравнивание одиночной кнопки в форме.
 */
export function Inline({ align = "center", className, children }: InlineProps) {
  return <div className={cn(INLINE_CLASS, alignClass[align], className)}>{children}</div>;
}
