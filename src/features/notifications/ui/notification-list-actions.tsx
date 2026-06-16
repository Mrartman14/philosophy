"use client";
// src/features/notifications/ui/notification-list-actions.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { markAllRead, markAllSeen } from "../actions";

export function NotificationListActions() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<ActionResult>, okMsg: string) {
    setPending(true);
    try {
      const result = await action();
      if (!result.success) {
        toast.add({
          title: result.code === "forbidden" ? "Нет прав" : "Ошибка",
          description: result.code === "forbidden" ? "У вас нет прав." : result.error,
        });
        return;
      }
      toast.add({ title: okMsg });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          void run(markAllRead, "Все отмечены прочитанными");
        }}
      >
        Прочитать все
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          void run(markAllSeen, "Отмечены просмотренными");
        }}
      >
        Просмотреть все
      </Button>
    </div>
  );
}
