// src/components/ui/text-input.tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ className, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded border border-(--color-border) bg-(--color-background) px-3 text-sm",
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
