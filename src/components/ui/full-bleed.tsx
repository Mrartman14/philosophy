// src/components/ui/full-bleed.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Логическая bleed-колонка грида (на всю ширину viewport). */
export const FULL_BLEED_CLASS = "col-bleed";

export interface FullBleedProps {
  className?: string;
  children: ReactNode;
}

/**
 * Full-bleed регион: escape из хребта на всю ширину viewport. ДОЛЖЕН быть прямым
 * потомком `.page-grid`. Единственное исключение из 720-хребта — для
 * полноэкранных сцен (map/graph). Гасит декоративный бордер хребта (см. layout.css
 * opt-out `:has(> .col-bleed)`). Structural-примитив → className ОТКРЫТ.
 */
export function FullBleed({ className, children }: FullBleedProps) {
  return <div className={cn(FULL_BLEED_CLASS, className)}>{children}</div>;
}
