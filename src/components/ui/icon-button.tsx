// src/components/ui/icon-button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

import type { ButtonVariant } from "./button";
import { cn, FOCUS_RING_CONTROL } from "./cn";

export type IconButtonSize = "sm" | "md";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * Геометрия иконочной кнопки. `md` (по умолчанию) — 36px, прежнее поведение.
   * `sm` — 28px для компактных тогглов.
   */
  size?: IconButtonSize;
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

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = "ghost", size = "md", className, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded transition",
          sizeClasses[size],
          FOCUS_RING_CONTROL,
          variantClasses[variant],
          className,
        )}
        {...rest}
      />
    );
  },
);
