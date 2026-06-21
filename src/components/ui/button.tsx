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

/** Нативные атрибуты `<button>` БЕЗ `className` — «вид» закрыт. */
type ButtonBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

/**
 * Дискриминированный union: `className` существует в типе ТОЛЬКО в ветке
 * `unstyled: true` — единственный escape для «вида». В styled-ветке className
 * отсутствует, поэтому позиционные/видовые классы нельзя навесить на контрол
 * фиксированной геометрии; их место — на родителе (`Inline`/`Stack`) или, для
 * кликабельных строк, в `unstyled`-режиме.
 *
 * - `tone` — визуальная иерархия (ось намерения, не геометрии): `primary`
 *   (filled, по умолчанию), `neutral` (border + bg-subtle), `quiet`
 *   (hover-only, без resting-хрома), `danger` (danger-solid).
 * - `compact` — структурно-компактный размер контрола (ось, ортогональная
 *   глобальной плотности): `false` → `--size-control-h-md`, `true` →
 *   `--size-control-h-sm`. Оба токена density-aware.
 * - `unstyled` — escape-режим для кликабельных строк/карточек, которые НЕ
 *   являются контролом фиксированной геометрии. Рендерит нативный `<button>`
 *   только с focus-ring + className вызывающего: без геометрии (`h-…`/`px-…`),
 *   без тоновой заливки, без `inline-flex items-center justify-center`.
 *   Геометрию и раскладку полностью задаёт вызывающий; `tone` игнорируется.
 */
export type ButtonProps =
  | (ButtonBase & { tone?: ButtonTone; compact?: boolean; unstyled?: false })
  | (ButtonBase & { unstyled: true; className?: string });

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  props,
  ref,
) {
  if (props.unstyled) {
    // unstyled-ветка: className присутствует в типе. Только focus-ring + класс
    // вызывающего — никакой геометрии/заливки.
    const { unstyled: _unstyled, className, type = "button", ...rest } = props;
    return <button ref={ref} type={type} className={cn(FOCUS_RING_CONTROL, className)} {...rest} />;
  }
  // styled-ветка: className отсутствует в типе. Дополнительно срезаем возможный
  // stray-className (если кто-то обошёл типы), чтобы он не протёк в DOM через
  // ...rest и не перекрыл вычисленные kit-классы.
  const {
    tone = "primary",
    compact = false,
    unstyled: _unstyled,
    className: _strayClassName,
    type = "button",
    ...rest
  } = props as ButtonBase & {
    tone?: ButtonTone;
    compact?: boolean;
    unstyled?: false;
    className?: string;
  };
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded px-4 text-sm font-medium transition",
        compact ? "h-(--size-control-h-sm)" : "h-(--size-control-h-md)",
        FOCUS_RING_CONTROL,
        toneClasses[tone],
      )}
      {...rest}
    />
  );
});
