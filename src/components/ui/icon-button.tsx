// src/components/ui/icon-button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

import type { ButtonVariant } from "./button";
import { cn, FOCUS_RING_CONTROL } from "./cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Обязательный label для скринридеров. */
  "aria-label": string;
}

/**
 * Намеренно отличается от `Button.variantClasses`: иконочная кнопка не должна
 * визуально конкурировать с основной (filled) кнопкой формы. `secondary` —
 * без resting-фона; `danger` — текстом, без заливки.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-(--color-border) hover:bg-(--color-surface-subtle) disabled:opacity-50",
  ghost: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  danger: "text-(--color-danger) hover:bg-(--color-danger-bg) disabled:opacity-50",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ variant = "ghost", className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded transition",
          FOCUS_RING_CONTROL,
          variantClasses[variant],
          className,
        )}
        {...rest}
      />
    );
  },
);
