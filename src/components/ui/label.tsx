// src/components/ui/label.tsx
import { forwardRef, type LabelHTMLAttributes } from "react";

import { cn } from "./cn";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/**
 * Styled нативный <label>. Base UI отдельного Label-примитива не предоставляет
 * (только Field.Label внутри Field), поэтому для standalone-меток — единая
 * styled-обёртка вместо россыпи сырых <label>.
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...rest },
  ref,
) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- generic standalone-обёртка: ассоциация с контролом задаётся потребителем через htmlFor/обёртывание на месте вызова, статически правилу не видна
    <label ref={ref} className={cn("text-sm font-medium", className)} {...rest} />
  );
});
