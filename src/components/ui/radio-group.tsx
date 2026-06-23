"use client";
// src/components/ui/radio-group.tsx
import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { useId, type ReactNode } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

interface RadioGroupOption {
  value: string;
  label: string;
  /**
   * Опциональный визуал сегмента (например, глиф «Aa» нужного размера). Когда
   * задан — рендерится как `aria-hidden` декорация, а доступным именем сегмента
   * остаётся текстовый `label` (sr-only). Без него `label` рендерится как обычно.
   */
  content?: ReactNode;
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
 *
 * Клавиатура: стрелки (←/→/↑/↓) переключают выбор по WAI-ARIA-паттерну
 * `radiogroup` (roving focus, composite Base UI). Home/End по APG опциональны и
 * не включены нижележащим Base UI-композитом (`RadioGroup` не отдаёт публичного
 * пропа для их активации), поэтому здесь намеренно не эмулируются вручную —
 * чтобы не воевать с библиотекой.
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
      onValueChange={onValueChange}
      // Без overflow-hidden: offset-2 focus-ring корневых сегментов иначе
      // обрезался бы краем группы. Скругление концов даём логически на крайних
      // сегментах (rounded-s/rounded-e), пилюля визуально цельная и RTL-safe.
      className="inline-flex rounded border border-(--color-border)"
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
              "first:rounded-s last:rounded-e",
              FOCUS_RING_CONTROL,
              // B1 (WCAG 1.4.1): выбор не только цветом. Заливка fg/surface (как у
              // Checkbox, APCA-safe) + не-цветовой аффорданс font-semibold, а под
              // forced-colors — системные Highlight/HighlightText, чтобы сегмент
              // оставался различим в Windows High-Contrast.
              "data-[checked]:bg-(--color-fg) data-[checked]:text-(--color-surface)",
              "data-[checked]:font-semibold",
              "data-[checked]:forced-colors:bg-[Highlight] data-[checked]:forced-colors:text-[HighlightText]",
              "data-[disabled]:opacity-50",
            )}
          >
            {opt.content == null ? (
              <span id={labelId}>{opt.label}</span>
            ) : (
              <>
                {/* Декоративный визуал скрыт от AT, чтобы доступным именем
                    сегмента остался текст-метка (opt.label), а не глиф. */}
                <span aria-hidden="true">{opt.content}</span>
                <span id={labelId} className="sr-only">{opt.label}</span>
              </>
            )}
          </Radio.Root>
        );
      })}
    </BaseRadioGroup>
  );
}
