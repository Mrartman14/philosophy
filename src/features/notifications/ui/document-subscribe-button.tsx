"use client";
// src/features/notifications/ui/document-subscribe-button.tsx
import { useState } from "react";

import { Button, useToast } from "@/components/ui";

import { subscribeDocument, unsubscribeDocument } from "../actions";

interface DocumentSubscribeButtonProps {
  documentId: string;
  initialSubscribed: boolean;
}

export function DocumentSubscribeButton({
  documentId,
  initialSubscribed,
}: DocumentSubscribeButtonProps) {
  const toast = useToast();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !subscribed;
    setPending(true);
    setSubscribed(next); // оптимистично
    try {
      const result = next
        ? await subscribeDocument(documentId)
        : await unsubscribeDocument(documentId);
      if (!result.success) {
        setSubscribed(!next); // откат
        toast.add({
          title: "Ошибка",
          description:
            result.code === "forbidden"
              ? "У вас нет прав на подписку."
              : result.error,
        });
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
