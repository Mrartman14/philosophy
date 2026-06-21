// src/components/ui/textarea.tsx
import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

/**
 * Leaf-контрол: className НЕ принимается (вид textarea фиксирован kit'ом).
 * Растяжение по высоте в flex-колонке — типизированным `grow`, а не «протёкшим»
 * позиционным className. Моноширинный режим для JSON/код-редакторов — `mono`.
 * Любой позиционный/размерный класс задаёт structural-родитель.
 */
export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  /** `true` → `min-h-0 flex-1`: тянуть textarea по высоте flex-колонки. */
  grow?: boolean;
  /** `true` → `font-mono text-xs`: моноширинный мелкий режим для JSON/кода. */
  mono?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ grow, mono, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          SHELL_BASE,
          "block w-full px-(--space-control-pad-x) py-(--space-control-pad-y) text-sm",
          "placeholder:text-(--color-fg-muted)",
          FOCUS_RING_INPUT,
          "disabled:opacity-50 data-[invalid]:border-(--color-danger)",
          grow && "min-h-0 flex-1",
          mono && "font-mono text-xs",
        )}
        {...rest}
      />
    );
  },
);
