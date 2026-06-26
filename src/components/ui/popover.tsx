"use client";
// src/components/ui/popover.tsx
import { Popover as BasePopover } from "@base-ui/react/popover";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn, OVERLAY_LAYER } from "./cn";

/**
 * Compound-обёртка над Base UI Popover. Root/Trigger/Portal/Positioner — прямой
 * passthrough; Popup/Arrow несут общий surface-стиль и мёржат className поверх.
 * className трактуется как строка (проектный cn — наивный join без tailwind-merge):
 * на call-site дублирующие surface-классы убираются, остаётся только позиционное/размерное.
 */
const Popup = forwardRef<
  ComponentRef<typeof BasePopover.Popup>,
  ComponentPropsWithoutRef<typeof BasePopover.Popup>
>(function PopoverPopup({ className, ...rest }, ref) {
  return (
    <BasePopover.Popup
      ref={ref}
      className={cn(
        "rounded border border-(--color-border) bg-(--color-surface) shadow-lg",
        className as string,
      )}
      {...rest}
    />
  );
});

// Positioner — позиционируемый fixed-элемент; несёт OVERLAY_LAYER (z-index над
// sticky-хедером, см. cn.ts), иначе passthrough наследовал бы z:auto и прятался.
const Positioner = forwardRef<
  ComponentRef<typeof BasePopover.Positioner>,
  ComponentPropsWithoutRef<typeof BasePopover.Positioner>
>(function PopoverPositioner({ className, ...rest }, ref) {
  return <BasePopover.Positioner ref={ref} className={cn(OVERLAY_LAYER, className as string)} {...rest} />;
});

const Arrow = forwardRef<
  ComponentRef<typeof BasePopover.Arrow>,
  ComponentPropsWithoutRef<typeof BasePopover.Arrow>
>(function PopoverArrow({ className, ...rest }, ref) {
  return (
    <BasePopover.Arrow
      ref={ref}
      className={cn("fill-(--color-surface) stroke-(--color-border)", className as string)}
      {...rest}
    />
  );
});

export const Popover = {
  Root: BasePopover.Root,
  Trigger: BasePopover.Trigger,
  Portal: BasePopover.Portal,
  Positioner,
  Popup,
  Arrow,
  Close: BasePopover.Close,
};
