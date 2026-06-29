"use client";
// src/components/ui/toolbar.tsx
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn, CONTROL_BOX, FOCUS_RING_CONTROL } from "./cn";

/**
 * Compound-обёртка над Base UI Toolbar. Root/Button/Group/Separator несут общие
 * дефолты редакторного тулбара (вынесены из inline-классов ast-editor); className
 * мёржится поверх (строкой — проектный cn без tailwind-merge).
 */
const Root = forwardRef<
  ComponentRef<typeof BaseToolbar.Root>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Root>
>(function ToolbarRoot({ className, ...rest }, ref) {
  // flex-wrap: тулбар редактора шире контейнера (≈7 групп) — без переноса
  // последняя группа (@/ref) уходила за край и обрезалась `overflow-hidden`
  // обёртки. gap-0.5 — максимально плотные зазоры между группами.
  return <BaseToolbar.Root ref={ref} className={cn("flex flex-wrap items-center gap-0.5 p-1", className as string)} {...rest} />;
});

const Group = forwardRef<
  ComponentRef<typeof BaseToolbar.Group>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Group>
>(function ToolbarGroup({ className, ...rest }, ref) {
  return <BaseToolbar.Group ref={ref} className={cn("flex items-center gap-0.5", className as string)} {...rest} />;
});

const Button = forwardRef<
  ComponentRef<typeof BaseToolbar.Button>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Button>
>(function ToolbarButton({ className, ...rest }, ref) {
  return (
    <BaseToolbar.Button
      ref={ref}
      className={cn(
        CONTROL_BOX,
        // Высота — density-aware токен контрола (на тир ниже дефолтного
        // IconButton: редакторный тулбар плотнее), а не литерал `h-8`. `min-w`
        // держит icon-only кнопку квадратной, `px-1.5` даёт текстовым триггерам
        // растянуться шире квадрата без лишнего внутреннего отступа у иконок.
        "h-(--size-control-h-sm) min-w-(--size-control-h-sm) px-1.5",
        "hover:bg-(--color-surface-subtle)",
        // Активное (выбранное) состояние — инверсная заливка, тот же язык, что
        // у IconButton tone="primary" (bg-fg / text-surface). Отдельно от hover,
        // чтобы «формат включён» читался сразу; на hover активной кнопки — opacity-90.
        "aria-pressed:bg-(--color-fg) aria-pressed:text-(--color-surface)",
        "aria-pressed:hover:bg-(--color-fg) aria-pressed:hover:opacity-90",
        "disabled:opacity-50",
        FOCUS_RING_CONTROL,
        className as string,
      )}
      {...rest}
    />
  );
});

const Separator = forwardRef<
  ComponentRef<typeof BaseToolbar.Separator>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Separator>
>(function ToolbarSeparator({ className, ...rest }, ref) {
  return <BaseToolbar.Separator ref={ref} className={cn("mx-0.5 h-5 w-px bg-(--color-border)", className as string)} {...rest} />;
});

export const Toolbar = { Root, Group, Button, Separator };
