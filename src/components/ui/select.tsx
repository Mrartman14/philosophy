"use client";
// src/components/ui/select.tsx
import { Select as BaseSelect } from "@base-ui/react/select";
import type { ReactNode } from "react";

import { useT } from "@/i18n/client";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  /** По умолчанию локализованное «Выберите…» (common.select.placeholder). */
  placeholder?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Тонкая обёртка над Base UI Select. Form-кейс: передай `name` — Base UI Select
 * сам отрисует hidden input под капотом.
 */
export function Select({
  name,
  defaultValue,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const t = useT("common");
  const placeholderText = placeholder ?? t("select.placeholder");
  const labelByValue = new Map(options.map((o) => [o.value, o.label]));

  return (
    <BaseSelect.Root
      name={name}
      defaultValue={defaultValue}
      value={value}
      onValueChange={(v: string | null) => onValueChange?.(v ?? "")}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          SHELL_BASE,
          "inline-flex h-(--size-control-h-md) w-full items-center justify-between gap-2 px-(--space-control-pad-x) text-sm",
          FOCUS_RING_INPUT,
          "data-[disabled]:opacity-50",
          className,
        )}
      >
        <BaseSelect.Value>
          {(v: string | null) => (v != null ? (labelByValue.get(v) ?? v) : placeholderText)}
        </BaseSelect.Value>
        <BaseSelect.Icon>▾</BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4} className="outline-none">
          <BaseSelect.Popup className={cn(SHELL_BASE, "min-w-(--anchor-width) p-1 shadow-lg")}>
            {options.map((opt) => (
              <BaseSelect.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "flex cursor-pointer items-center rounded px-2 py-1.5 text-sm outline-none",
                  "data-[highlighted]:bg-(--color-surface-subtle)",
                  "data-[selected]:font-semibold",
                )}
              >
                <BaseSelect.ItemText>{opt.label}</BaseSelect.ItemText>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
