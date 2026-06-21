"use client";
// src/features/notifications/ui/notification-list-actions.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";
import type { ActionResult } from "@/utils/create-action";

import { markAllRead, markAllSeen } from "../actions";

export function NotificationListActions() {
  const router = useRouter();
  const toast = useToast();
  const t = useT("notifications");
  const tErrors = useT("errors");
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<ActionResult>, okMsg: string) {
    setPending(true);
    try {
      const result = await action();
      if (!result.success) {
        toastActionError(toast, tErrors, result, { action: t("notificationsAction") });
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
        tone="neutral"
        disabled={pending}
        onClick={() => {
          void run(markAllRead, t("markAllReadSuccess"));
        }}
      >
        {t("markAllReadButton")}
      </Button>
      <Button
        tone="quiet"
        disabled={pending}
        onClick={() => {
          void run(markAllSeen, t("markAllSeenSuccess"));
        }}
      >
        {t("markAllSeenButton")}
      </Button>
    </div>
  );
}
