"use client";
// src/components/ui/confirm-dialog.tsx
import { useRef, useState, type ReactNode } from "react";

import { Button } from "./button";
import { Dialog, DialogClose } from "./dialog";

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /**
   * Опциональный гейт на клике по триггеру. Если резолвится `false` —
   * подтверждение ПРОПУСКАЕТСЯ и `onConfirm` вызывается сразу (диалог не
   * открывается). Полезно, когда переспрашивать нужно лишь иногда (напр.
   * предупреждать об удалении офлайн-данных только если они есть). По ошибке —
   * fail-safe: диалог всё же показывается. Без пропа поведение прежнее.
   */
  shouldConfirm?: () => boolean | Promise<boolean>;
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
  shouldConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const gatingRef = useRef(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  // Перехватываем попытку ОТКРЫТЬ, если задан гейт: открываем диалог только
  // если он вернул true; иначе сразу выполняем действие без подтверждения.
  // Сохраняем Dialog.Trigger (и его a11y), решая лишь, открывать ли.
  function handleOpenChange(next: boolean) {
    if (next && shouldConfirm) {
      if (gatingRef.current) return;
      gatingRef.current = true;
      void (async () => {
        try {
          if (await shouldConfirm()) setOpen(true);
          else await onConfirm();
        } catch {
          setOpen(true); // fail-safe: лучше переспросить, чем выполнить молча
        } finally {
          gatingRef.current = false;
        }
      })();
      return;
    }
    setOpen(next);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
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
