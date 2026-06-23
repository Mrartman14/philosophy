// src/components/ui/number-field.tsx
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { forwardRef, type ComponentProps } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

// Root управляет числом; id/aria-label/placeholder проксируем на внутренний Input —
// поэтому исключаем их из Root-пропов, чтобы не сели на групп-обёртку (div).
type RootProps = Omit<
  ComponentProps<typeof BaseNumberField.Root>,
  "className" | "render" | "children" | "id" | "aria-label" | "placeholder"
>;

export type NumberFieldProps = RootProps & {
  /** Прокидывается на внутренний `<input>` (`NumberField.Input`). */
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  /** `true` → `flex-1 min-w-0`: тянуть инпут по свободной ширине flex-ряда. */
  grow?: boolean;
};

/**
 * Числовой leaf-контрол поверх Base UI `NumberField`. Парсинг/кламп числа живут
 * ВНУТРИ компонента: значение — `number | null` через `onValueChange`, без нативного
 * `<input type="number">` и его constraint-валидации (`badInput`/`typeMismatch`/range
 * → браузерные, нелокализованные сообщения). className закрыт (вид фиксирован kit'ом).
 *
 * `id`/`aria-label`/`placeholder` идут на внутренний `NumberField.Input`; числовые и
 * поведенческие пропы (`value`/`min`/`max`/`step`/`name`/`disabled`/`format`…) — на
 * `NumberField.Root` через rest. Степперы/scrub намеренно не рендерим (минимальный
 * примитив — голый числовой инпут); добавлять при реальной потребности.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField(
    { id, "aria-label": ariaLabel, placeholder, grow, ...rootProps },
    ref,
  ) {
    return (
      <BaseNumberField.Root {...rootProps}>
        <BaseNumberField.Input
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={cn(
            SHELL_BASE,
            "h-(--size-control-h-md) w-full px-(--space-control-pad-x) text-sm",
            "placeholder:text-(--color-fg-muted)",
            FOCUS_RING_INPUT,
            "disabled:opacity-50 data-[invalid]:border-(--color-danger)",
            grow && "min-w-0 flex-1",
          )}
        />
      </BaseNumberField.Root>
    );
  },
);
