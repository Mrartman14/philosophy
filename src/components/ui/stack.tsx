// src/components/ui/stack.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Класс вертикального ритма (вынесен для тестируемости без node-access). */
export const STACK_CLASS = "flex flex-col gap-(--space-stack)";

export interface StackProps {
  /** stretch (default) — дети тянутся по ширине; start — интринсик-ширина. */
  align?: "stretch" | "start";
  className?: string;
  children: ReactNode;
}

/**
 * Вертикальный layout-примитив kit: density-aware gap (`--space-stack`).
 * Structural — className ОТКРЫТ (раскладка, не вид контрола).
 */
export function Stack({ align = "stretch", className, children }: StackProps) {
  return (
    <div className={cn(STACK_CLASS, align === "start" ? "items-start" : "items-stretch", className)}>
      {children}
    </div>
  );
}
