"use client";
// src/components/ui/submit-button.tsx
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

/**
 * SubmitButton — всегда styled submit-CTA, `unstyled`-escape тут не имеет смысла.
 * Сужаем тип до styled-ветки union'а → `className`/`variant`/`size` закрыты на
 * уровне TS (голый `ButtonProps`-union в JSX пропускал className через
 * unstyled-ветку). Guardrail 8 дублирует это линтом.
 */
type SubmitButtonProps = Extract<ButtonProps, { unstyled?: false }>;

export function SubmitButton({ children, disabled, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- false || pending должен давать pending; ?? даст false
    <Button type="submit" disabled={disabled || pending} {...rest}>
      {children}
    </Button>
  );
}
