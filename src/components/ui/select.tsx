"use client";
// src/components/ui/select.tsx
import { Select as BaseSelect } from "@base-ui/react/select";
import type { ReactNode } from "react";

import { cn } from "./cn";

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
  placeholder = "Выберите…",
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
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
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded border border-(--color-border) bg-(--color-background) px-3 text-sm",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--color-foreground)",
          "data-[disabled]:opacity-50",
          className,
        )}
      >
        <BaseSelect.Value>
          {(v: string | null) => (v != null ? (labelByValue.get(v) ?? v) : placeholder)}
        </BaseSelect.Value>
        <BaseSelect.Icon>▾</BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4} className="outline-none">
          <BaseSelect.Popup className="min-w-(--anchor-width) rounded border border-(--color-border) bg-(--color-background) p-1 shadow-lg">
            {options.map((opt) => (
              <BaseSelect.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "flex cursor-pointer items-center rounded px-2 py-1.5 text-sm outline-none",
                  "data-[highlighted]:bg-(--color-text-pane)",
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
