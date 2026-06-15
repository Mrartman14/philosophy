"use client";
// src/components/ui/submit-button.tsx
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

export function SubmitButton({ children, disabled, ...rest }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- false || pending должен давать pending; ?? даст false
    <Button type="submit" disabled={disabled || pending} {...rest}>
      {children}
    </Button>
  );
}
