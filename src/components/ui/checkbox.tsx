"use client";
// src/components/ui/checkbox.tsx
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { forwardRef } from "react";

import { cn, FOCUS_RING_CONTROL, SHELL_BASE } from "./cn";

export interface CheckboxProps {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export const Checkbox = forwardRef<HTMLElement, CheckboxProps>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <BaseCheckbox.Root
      ref={ref}
      className={cn(
        SHELL_BASE,
        "inline-flex h-5 w-5 items-center justify-center",
        FOCUS_RING_CONTROL,
        "data-[checked]:bg-(--color-foreground) data-[checked]:text-(--color-background)",
        "data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator>✓</BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
});
