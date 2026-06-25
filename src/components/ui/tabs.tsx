"use client";
// src/components/ui/tabs.tsx
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

interface RootProps {
  /** Активная вкладка (controlled). */
  value?: string;
  /** Значение по умолчанию (uncontrolled). */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

function Root({ value, defaultValue, onValueChange, children }: RootProps) {
  return (
    <BaseTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(String(v))}
    >
      {children}
    </BaseTabs.Root>
  );
}

interface ListProps {
  children: ReactNode;
  "aria-label"?: string;
}

function List({ children, "aria-label": ariaLabel }: ListProps) {
  return (
    <BaseTabs.List
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1 border-b border-(--color-border)")}
    >
      {children}
    </BaseTabs.List>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  /** Полный текст в title (для усечённых длинных имён файлов). */
  title?: string;
}

function Tab({ value, children, title }: TabProps) {
  return (
    <BaseTabs.Tab
      value={value}
      title={title}
      className={cn(
        "-mb-px max-w-[14rem] cursor-pointer truncate rounded-t border-b-2 border-transparent px-3 py-1.5 text-sm",
        "text-(--color-fg-muted) outline-none transition-colors",
        "hover:text-(--color-fg)",
        // активный таб: акцентное подчёркивание + лёгкая заливка + полужирный.
        "data-[selected]:border-(--color-accent) data-[selected]:bg-(--color-surface-subtle) data-[selected]:font-semibold data-[selected]:text-(--color-fg)",
        FOCUS_RING_CONTROL,
      )}
    >
      {children}
    </BaseTabs.Tab>
  );
}

interface PanelProps {
  value: string;
  children: ReactNode;
  /** false (по умолчанию) — неактивная панель размонтируется. */
  keepMounted?: boolean;
}

function Panel({ value, children, keepMounted }: PanelProps) {
  return (
    <BaseTabs.Panel
      value={value}
      keepMounted={keepMounted}
      className={cn("pt-4 outline-none")}
    >
      {children}
    </BaseTabs.Panel>
  );
}

export const Tabs = { Root, List, Tab, Panel };
