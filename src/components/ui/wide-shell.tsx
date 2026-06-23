// src/components/ui/wide-shell.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";
import { FULL_BLEED_CLASS } from "./full-bleed";

/** Центрированный кап широкого шелла (= прежний max-w корневого main). */
export const WIDE_SHELL_INNER = "mx-auto w-full max-w-screen-lg";

export interface WideShellProps {
  className?: string;
  children: ReactNode;
}

/**
 * Широкий app-шелл: full-bleed escape + центрированный кап max-w-screen-lg.
 * Для дашбордов/гридов/секционных шеллов (/me, /admin) и страниц, которым тесен
 * 720-хребет и не нужны поля. ДОЛЖЕН быть прямым потомком `.page-grid`.
 */
export function WideShell({ className, children }: WideShellProps) {
  return (
    <div className={FULL_BLEED_CLASS}>
      <div className={cn(WIDE_SHELL_INNER, className)}>{children}</div>
    </div>
  );
}
