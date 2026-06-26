"use client";
// src/components/ui/context-menu.tsx
// Compound-обёртка над Base UI ContextMenu (меню по правому клику / long-press).
// Зеркало menu.tsx: Root/Trigger/Portal/Positioner — passthrough; Popup/Item/Separator
// несут общий surface/item-стиль (классы шарятся с menu.tsx). ВНИМАНИЕ: Separator у
// ContextMenu — отдельный примитив (../separator/Separator), НЕ из menu/; оборачиваем
// его cn-форвардером, чтобы стиль жил в ките, а не на call-site (Guardrail 8).
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn } from "./cn";
import { MENU_POPUP_CLASS, MENU_ITEM_CLASS } from "./menu";

const Popup = forwardRef<
  ComponentRef<typeof BaseContextMenu.Popup>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Popup>
>(function ContextMenuPopup({ className, ...rest }, ref) {
  return <BaseContextMenu.Popup ref={ref} className={cn(MENU_POPUP_CLASS, className as string)} {...rest} />;
});

const Item = forwardRef<
  ComponentRef<typeof BaseContextMenu.Item>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Item>
>(function ContextMenuItem({ className, ...rest }, ref) {
  return <BaseContextMenu.Item ref={ref} className={cn(MENU_ITEM_CLASS, className as string)} {...rest} />;
});

const Separator = forwardRef<
  ComponentRef<typeof BaseContextMenu.Separator>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Separator>
>(function ContextMenuSeparator({ className, ...rest }, ref) {
  return <BaseContextMenu.Separator ref={ref} className={cn("my-1 h-px bg-(--color-border)", className as string)} {...rest} />;
});

export const ContextMenu = {
  Root: BaseContextMenu.Root,
  Trigger: BaseContextMenu.Trigger,
  Portal: BaseContextMenu.Portal,
  Positioner: BaseContextMenu.Positioner,
  Popup,
  Item,
  Separator,
};
