// src/components/ui/button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-foreground) text-(--color-background) hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-(--color-border) bg-(--color-text-pane) hover:bg-(--color-background) disabled:opacity-50",
  ghost: "hover:bg-(--color-text-pane) disabled:opacity-50",
  danger: "bg-(--color-danger-fill) text-white hover:bg-(--color-danger-fill-hover) disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
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
