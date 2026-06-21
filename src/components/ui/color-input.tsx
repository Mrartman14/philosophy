// src/components/ui/color-input.tsx
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

// className закрыт; type фиксирован "color"; геометрия — внутренняя забота примитива.
export type ColorInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type">;

/** Контрол выбора цвета (своя геометрия color-picker). leaf — без className. */
export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  function ColorInput(props, ref) {
    return (
      <input
        ref={ref}
        type="color"
        className={cn(SHELL_BASE, "h-(--size-control-h-md) w-16 cursor-pointer p-1", FOCUS_RING_INPUT, "disabled:opacity-50")}
        {...props}
      />
    );
  },
);
