// src/components/ui/textarea.tsx
import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          SHELL_BASE,
          "block w-full px-3 py-2 text-sm",
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
