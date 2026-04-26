// src/components/ui/textarea.tsx
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "block w-full rounded border border-(--color-border) bg-(--color-background) px-3 py-2 text-sm",
          "placeholder:text-(--color-description)",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--color-foreground)",
          "disabled:opacity-50 data-[invalid]:border-red-500",
          className,
        )}
        {...rest}
      />
    );
  },
);
