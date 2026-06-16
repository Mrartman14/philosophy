"use client";
// src/components/ui/toaster.tsx
import { Toast as BaseToast } from "@base-ui/react/toast";

import { cn } from "./cn";

/**
 * Самодостаточный toast-viewport. Подписывается на менеджер Base UI и
 * рендерит все активные тосты. Помещать один раз рядом с `<ToastProvider>`
 * (обычно в root layout).
 *
 * Тип тоста (`type`): `error` подсвечивает красным; остальные — нейтрально.
 */
export function Toaster() {
  const { toasts } = BaseToast.useToastManager();

  return (
    <BaseToast.Portal>
      <BaseToast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <BaseToast.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "rounded border border-(--color-border) bg-(--color-background) p-3 shadow-lg",
              "data-[type=error]:border-(--color-danger)",
            )}
          >
            {toast.title !== undefined && (
              <BaseToast.Title className="text-sm font-semibold">
                {toast.title}
              </BaseToast.Title>
            )}
            {toast.description !== undefined && (
              <BaseToast.Description className="mt-1 text-xs text-(--color-description)">
                {toast.description}
              </BaseToast.Description>
            )}
          </BaseToast.Root>
        ))}
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
}
