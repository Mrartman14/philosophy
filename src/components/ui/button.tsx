// src/components/ui/button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

export type ButtonTone = "primary" | "neutral" | "quiet" | "danger";

const toneClasses: Record<ButtonTone, string> = {
  primary:
    "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  neutral:
    "border border-(--color-border) bg-(--color-surface-subtle) hover:bg-(--color-surface) disabled:opacity-50",
  quiet: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  danger: "bg-(--color-danger-solid) text-(--color-danger-on-solid) hover:opacity-90 disabled:opacity-50",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Визуальная иерархия кнопки (ось намерения, не геометрии):
   * `primary` (filled, по умолчанию), `neutral` (border + bg-subtle),
   * `quiet` (hover-only, без resting-хрома), `danger` (danger-solid).
   */
  tone?: ButtonTone;
  /**
   * Структурно-компактный размер контрола (ось, ортогональная глобальной
   * плотности): `false` → высота `--size-control-h-md`, `true` →
   * `--size-control-h-sm`. Оба токена density-aware.
   */
  compact?: boolean;
  /**
   * Escape-режим для кликабельных строк/карточек, которые НЕ являются
   * контролом фиксированной геометрии. Рендерит нативный `<button>` только
   * с focus-ring + className вызывающего: без геометрии (`h-…`/`px-…`),
   * без тоновой заливки, без `inline-flex items-center justify-center`.
   * Геометрию и раскладку полностью задаёт вызывающий; `tone`
   * при этом игнорируется.
   */
  unstyled?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = "primary", compact = false, unstyled = false, className, type = "button", ...rest },
  ref,
) {
  if (unstyled) {
    // Только focus-ring + класс вызывающего — никакой геометрии/заливки.
    return <button ref={ref} type={type} className={cn(FOCUS_RING_CONTROL, className)} {...rest} />;
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded px-4 text-sm font-medium transition",
        compact ? "h-(--size-control-h-sm)" : "h-(--size-control-h-md)",
        FOCUS_RING_CONTROL,
        toneClasses[tone],
        className,
      )}
      {...rest}
    />
  );
});
