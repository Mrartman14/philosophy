"use client";
// src/components/ui/combobox.tsx
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn } from "./cn";

/**
 * Compound-обёртка над Base UI Combobox. Большинство частей — прямой passthrough;
 * Popup несёт общий surface-стиль и мёржит className поверх (проектный cn — наивный
 * join, на call-site дублирующие surface-классы убираются). Guardrail 7: прикладной
 * код использует combobox только отсюда, не из @base-ui/react напрямую.
 */
const Popup = forwardRef<
  ComponentRef<typeof BaseCombobox.Popup>,
  ComponentPropsWithoutRef<typeof BaseCombobox.Popup>
>(function ComboboxPopup({ className, ...rest }, ref) {
  return (
    <BaseCombobox.Popup
      ref={ref}
      className={cn(
        "rounded border border-(--color-border) bg-(--color-surface) shadow-lg",
        className as string,
      )}
      {...rest}
    />
  );
});

export const Combobox = {
  Root: BaseCombobox.Root,
  Value: BaseCombobox.Value,
  Input: BaseCombobox.Input,
  Trigger: BaseCombobox.Trigger,
  Icon: BaseCombobox.Icon,
  Portal: BaseCombobox.Portal,
  Positioner: BaseCombobox.Positioner,
  Popup,
  List: BaseCombobox.List,
  Item: BaseCombobox.Item,
  Group: BaseCombobox.Group,
  GroupLabel: BaseCombobox.GroupLabel,
  Collection: BaseCombobox.Collection,
  Status: BaseCombobox.Status,
  Empty: BaseCombobox.Empty,
  Separator: BaseCombobox.Separator,
};
