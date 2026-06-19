"use client";
// src/features/notifications/ui/subscribe-button.tsx
// Приватный generic-компонент. Не экспортируется из index.ts.
// Публичные обёртки: DocumentSubscribeButton, LectureSubscribeButton.
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";
import type { ActionResult } from "@/utils/create-action";

interface SubscribeButtonProps {
  entityId: string;
  initialSubscribed: boolean;
  subscribeAction: (id: string) => Promise<ActionResult>;
  unsubscribeAction: (id: string) => Promise<ActionResult>;
}

export function SubscribeButton({
  entityId,
  initialSubscribed,
  subscribeAction,
  unsubscribeAction,
}: SubscribeButtonProps) {
  const toast = useToast();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !subscribed;
    setPending(true);
    setSubscribed(next); // оптимистично
    try {
      const result = next
        ? await subscribeAction(entityId)
        : await unsubscribeAction(entityId);
      if (!result.success) {
        setSubscribed(!next); // откат
        toastActionError(toast, result, { action: "подписку" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      {...(subscribed ? { variant: "secondary" as const } : {})}
      disabled={pending}
      onClick={() => {
        void toggle();
      }}
    >
      {subscribed ? "Отписаться" : "Подписаться"}
    </Button>
  );
}
