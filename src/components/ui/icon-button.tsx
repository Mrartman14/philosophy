// src/components/ui/icon-button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

export type IconButtonTone = "neutral" | "primary" | "danger";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> & {
  /**
   * Визуальная иерархия иконочной кнопки: `neutral` (hover-only, по умолчанию),
   * `primary` (filled), `danger` (текстовый danger).
   */
  tone?: IconButtonTone;
  /**
   * Структурно-компактная геометрия (ось, ортогональная глобальной плотности):
   * квадрат высотой контрола. `false` (по умолчанию) → `--size-control-h-md`,
   * `true` → `--size-control-h-sm`. Оба токена density-aware.
   */
  compact?: boolean;
  /** Обязательный label для скринридеров. */
  "aria-label": string;
};

/**
 * Иконочная кнопка по природе тихая: `neutral` = hover-only (то, что у Button
 * называется `quiet`). Отдельный набор тонов — сознательное расхождение с Button
 * (у IconButton НЕТ `quiet`, его `neutral` уже тихий), чтобы иконочный контрол
 * не конкурировал с filled-кнопкой формы.
 */
const toneClasses: Record<IconButtonTone, string> = {
  neutral: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  primary:
    "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  danger: "text-(--color-danger) hover:bg-(--color-danger-bg) disabled:opacity-50",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { tone = "neutral", compact = false, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded transition",
          compact
            ? "h-(--size-control-h-sm) w-(--size-control-h-sm)"
            : "h-(--size-control-h-md) w-(--size-control-h-md)",
          FOCUS_RING_CONTROL,
          toneClasses[tone],
        )}
        {...rest}
      />
    );
  },
);
