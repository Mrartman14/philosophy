"use client";
// src/components/ui/radio-group.tsx
import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { useId } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

interface RadioGroupOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  options: RadioGroupOption[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  "aria-label": string;
}

/**
 * Segmented single-select (выбор-одного-из-N). Drop-in под `Select` API:
 * same `{ options, value, onValueChange, aria-label }`. Сегменты встык, активный
 * залит. RTL-порядок корректен через flex + логические границы.
 */
export function RadioGroup({
  options,
  value,
  onValueChange,
  name,
  disabled,
  "aria-label": ariaLabel,
}: RadioGroupProps) {
  // Префикс для per-сегментных id текста-метки. Внутри <FormField> Base UI через
  // LabelableContext навешивает aria-labelledby группы (Field.Label) на КАЖДЫЙ
  // Radio.Root, из-за чего у всех сегментов доступное имя = метка группы (WCAG
  // 4.1.2). Явный aria-labelledby на сегменте имеет приоритет над контекстным
  // labelId (useAriaLabelledBy: explicit ?? labelId ?? fallback), поэтому
  // указываем каждому сегменту его собственный текст-метку.
  const labelIdPrefix = useId();
  return (
    <BaseRadioGroup
      aria-label={ariaLabel}
      name={name}
      disabled={disabled}
      value={value}
      onValueChange={(v) => {
        onValueChange(v);
      }}
      className="inline-flex overflow-hidden rounded border border-(--color-border)"
    >
      {options.map((opt) => {
        const labelId = `${labelIdPrefix}-${opt.value}`;
        return (
          <Radio.Root
            key={opt.value}
            value={opt.value}
            aria-labelledby={labelId}
            className={cn(
              "h-(--size-control-h-md) cursor-pointer px-(--space-control-pad-x) text-sm",
              "inline-flex items-center justify-center",
              "border-(--color-border) [&:not(:first-child)]:border-s",
              FOCUS_RING_CONTROL,
              "data-[checked]:bg-(--color-fg) data-[checked]:text-(--color-surface)",
              "data-[disabled]:opacity-50",
            )}
          >
            <span id={labelId}>{opt.label}</span>
          </Radio.Root>
        );
      })}
    </BaseRadioGroup>
  );
}
