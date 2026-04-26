"use client";
// src/components/ui/dialog.tsx
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Тонкая обёртка над Base UI Dialog. Контракт:
 * - `trigger` — любой ReactNode; если это валидный ReactElement, он
 *   передаётся в `Dialog.Trigger render={...}` для композиции с базовым
 *   `<button>` (Base UI клонирует и подсасывает свои props/refs).
 * - Контролируемый режим — через `open` + `onOpenChange`.
 */
export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const rootProps: {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  } = {};
  if (open !== undefined) rootProps.open = open;
  if (defaultOpen !== undefined) rootProps.defaultOpen = defaultOpen;
  if (onOpenChange !== undefined) rootProps.onOpenChange = onOpenChange;

  return (
    <BaseDialog.Root {...rootProps}>
      {trigger !== undefined &&
        (isValidElement(trigger) ? (
          <BaseDialog.Trigger render={trigger as ReactElement} />
        ) : (
          <BaseDialog.Trigger>{trigger}</BaseDialog.Trigger>
        ))}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-background) p-6 shadow-xl",
            "transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            className,
          )}
        >
          <BaseDialog.Title className="text-lg font-semibold">{title}</BaseDialog.Title>
          {description !== undefined && (
            <BaseDialog.Description className="mt-1 text-sm text-(--color-description)">
              {description}
            </BaseDialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export const DialogClose = BaseDialog.Close;
