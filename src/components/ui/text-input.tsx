// src/components/ui/text-input.tsx
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ className, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          SHELL_BASE,
          "h-10 w-full px-3 text-sm",
          "placeholder:text-(--color-description)",
          FOCUS_RING_INPUT,
          "disabled:opacity-50 data-[invalid]:border-red-500",
          className,
        )}
        {...rest}
      />
    );
  },
);
