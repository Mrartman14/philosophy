"use client";
// src/components/ui/confirm-dialog.tsx
import { useState, type ReactNode } from "react";
import { Dialog, DialogClose } from "./dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Подтверждение действия с поддержкой async-обработчика. Закрывает диалог
 * только после успешного завершения `onConfirm`. Кнопка отмены — нативный
 * `Dialog.Close` через render-prop.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={title}
      {...(description !== undefined ? { description } : {})}
    >
      <div className="flex justify-end gap-2">
        <DialogClose render={<Button variant="ghost">{cancelLabel}</Button>} />
        <Button
          variant={destructive ? "danger" : "primary"}
          disabled={pending}
          onClick={() => { void handleConfirm(); }}
        >
          {pending ? "…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
