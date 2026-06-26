"use client";
// src/components/ui/menu.tsx
// Compound-обёртка над Base UI Menu (dropdown-меню действий). Зеркало popover.tsx:
// Root/Trigger/Portal/Positioner — passthrough; Popup несёт общий surface-стиль;
// Item/LinkItem — стиль пункта (LinkItem рендерит <a> для ссылок-действий).
// className — наивный cn-join (как в ките), на call-site без дублей surface.
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn, OVERLAY_LAYER } from "./cn";

// Общие классы стиля поверхности/пункта меню — переиспользуются в context-menu.tsx
// (ContextMenu.Popup/.Item оборачивают ТЕ ЖЕ Base UI menu-части), чтобы строки не
// дублировались байт-в-байт. Не менять без синхронизации обоих китов.
export const MENU_POPUP_CLASS =
  "min-w-44 rounded border border-(--color-border) bg-(--color-surface) p-1 shadow-lg outline-none";
export const MENU_ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-(--color-surface-subtle) data-[disabled]:opacity-50";

// Positioner несёт OVERLAY_LAYER (z-index над sticky-хедером, см. cn.ts), иначе
// passthrough наследовал бы z:auto и меню пряталось бы под хедер.
const Positioner = forwardRef<
  ComponentRef<typeof BaseMenu.Positioner>,
  ComponentPropsWithoutRef<typeof BaseMenu.Positioner>
>(function MenuPositioner({ className, ...rest }, ref) {
  return <BaseMenu.Positioner ref={ref} className={cn(OVERLAY_LAYER, className as string)} {...rest} />;
});

const Popup = forwardRef<
  ComponentRef<typeof BaseMenu.Popup>,
  ComponentPropsWithoutRef<typeof BaseMenu.Popup>
>(function MenuPopup({ className, ...rest }, ref) {
  return <BaseMenu.Popup ref={ref} className={cn(MENU_POPUP_CLASS, className as string)} {...rest} />;
});

const Item = forwardRef<
  ComponentRef<typeof BaseMenu.Item>,
  ComponentPropsWithoutRef<typeof BaseMenu.Item>
>(function MenuItem({ className, ...rest }, ref) {
  return <BaseMenu.Item ref={ref} className={cn(MENU_ITEM_CLASS, className as string)} {...rest} />;
});

const LinkItem = forwardRef<
  ComponentRef<typeof BaseMenu.LinkItem>,
  ComponentPropsWithoutRef<typeof BaseMenu.LinkItem>
>(function MenuLinkItem({ className, ...rest }, ref) {
  return (
    <BaseMenu.LinkItem ref={ref} className={cn(MENU_ITEM_CLASS, "no-underline", className as string)} {...rest} />
  );
});

export const Menu = {
  Root: BaseMenu.Root,
  Trigger: BaseMenu.Trigger,
  Portal: BaseMenu.Portal,
  Positioner,
  Popup,
  Item,
  LinkItem,
  Separator: BaseMenu.Separator,
};
