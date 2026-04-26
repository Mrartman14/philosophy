"use client";
// src/components/ui/submit-button.tsx
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

export function SubmitButton({ children, disabled, ...rest }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} {...rest}>
      {pending ? "…" : children}
    </Button>
  );
}
