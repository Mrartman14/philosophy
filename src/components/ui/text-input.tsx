// src/components/ui/text-input.tsx
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

/**
 * Leaf-контрол: className НЕ принимается (вид инпута фиксирован kit'ом).
 * Растяжение в горизонтальном ряду (`Inline`) — типизированным `grow`, а не
 * «протёкшим» позиционным className. Любой позиционный/размерный класс задаёт
 * structural-родитель (`Inline`/`Stack`/обёртка).
 */
export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  /** `true` → `flex-1 min-w-0`: тянуть инпут по свободной ширине flex-ряда. */
  grow?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ grow, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          SHELL_BASE,
          "h-(--size-control-h-md) w-full px-(--space-control-pad-x) text-sm",
          "placeholder:text-(--color-fg-muted)",
          FOCUS_RING_INPUT,
          "disabled:opacity-50 data-[invalid]:border-(--color-danger)",
          grow && "min-w-0 flex-1",
        )}
        {...rest}
      />
    );
  },
);
