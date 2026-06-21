"use client";
// src/components/ui/navigation-menu.tsx
import { NavigationMenu as BaseNavigationMenu } from "@base-ui/react/navigation-menu";

/**
 * Compound-обёртка над Base UI NavigationMenu. Единственный потребитель
 * (app-header) несёт полностью bespoke-разметку, поэтому обёртка не навязывает
 * дефолтных классов — только маршрутизирует импорт через kit (ноль прямых
 * @base-ui/react вне UI-kit). Все части — прямой re-export, className/ref
 * проходят как есть.
 */
export const NavigationMenu = {
  Root: BaseNavigationMenu.Root,
  List: BaseNavigationMenu.List,
  Item: BaseNavigationMenu.Item,
  Trigger: BaseNavigationMenu.Trigger,
  Content: BaseNavigationMenu.Content,
  Positioner: BaseNavigationMenu.Positioner,
  Portal: BaseNavigationMenu.Portal,
  Popup: BaseNavigationMenu.Popup,
  Viewport: BaseNavigationMenu.Viewport,
  Arrow: BaseNavigationMenu.Arrow,
  Link: BaseNavigationMenu.Link,
};
