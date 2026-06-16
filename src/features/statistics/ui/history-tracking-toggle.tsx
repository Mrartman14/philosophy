"use client";
// src/features/statistics/ui/history-tracking-toggle.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { setHistoryTracking } from "../actions";

interface Props {
  initialEnabled: boolean;
  /** canManageOwnHistory(me) со страницы (server component). */
  canManage: boolean;
}

export function HistoryTrackingToggle({ initialEnabled, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    try {
      const result = await setHistoryTracking(next);
      if (!result.success) {
        toastActionError(toast, result, { action: "изменение настроек" });
        return;
      }
      setEnabled(next);
      toast.add({
        title: "Сохранено",
        description: next
          ? "Трекинг просмотров включён."
          : "Трекинг выключен, история удалена.",
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (enabled) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Трекинг просмотров включён.</p>
        <ConfirmDialog
          trigger={
            <Button
              variant="secondary"
              className="self-start"
              disabled={pending || !canManage}
            >
              Выключить
            </Button>
          }
          title="Выключить трекинг?"
          description="Вся история просмотров будет удалена безвозвратно."
          destructive
          confirmLabel="Удалить историю"
          onConfirm={() => apply(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Трекинг просмотров выключен.</p>
      <Button
        className="self-start"
        disabled={pending || !canManage}
        onClick={() => {
          void apply(true);
        }}
      >
        Включить
      </Button>
      {!canManage && (
        <p className="text-sm text-(--color-description)">
          У вас нет прав на изменение настроек.
        </p>
      )}
    </div>
  );
}
