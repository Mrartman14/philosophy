// src/components/ui/label.tsx
import { forwardRef, type LabelHTMLAttributes } from "react";

export type LabelProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, "className">;

/**
 * Styled нативный <label>. Base UI отдельного Label-примитива не предоставляет
 * (только Field.Label внутри Field), поэтому для standalone-меток — единая
 * styled-обёртка вместо россыпи сырых <label>. Класс зафиксирован
 * (`text-sm font-medium`); раскладка/стиль вокруг метки — на родителе.
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  props,
  ref,
) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- generic standalone-обёртка: ассоциация с контролом задаётся потребителем через htmlFor/обёртывание на месте вызова, статически правилу не видна
    <label ref={ref} {...props} className="text-sm font-medium" />
  );
});
