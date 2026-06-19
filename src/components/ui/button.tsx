// src/components/ui/button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-(--color-border) bg-(--color-surface-subtle) hover:bg-(--color-surface) disabled:opacity-50",
  ghost: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  danger: "bg-(--color-danger-solid) text-(--color-danger-on-solid) hover:opacity-90 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-(--size-control-h-sm) px-3 text-sm",
  md: "h-(--size-control-h-md) px-4 text-sm",
  lg: "h-(--size-control-h-lg) px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-medium transition",
        FOCUS_RING_CONTROL,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    />
  );
});
