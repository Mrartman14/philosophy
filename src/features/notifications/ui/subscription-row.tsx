"use client";
// src/features/notifications/ui/subscription-row.tsx
import { useState } from "react";

import { Button, RouterLink, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { unsubscribeDocument } from "../actions";
import type { DocumentSubscription } from "../types";

interface SubscriptionRowProps {
  subscription: DocumentSubscription;
}

export function SubscriptionRow({ subscription }: SubscriptionRowProps) {
  const toast = useToast();
  const [removed, setRemoved] = useState(false);
  const [pending, setPending] = useState(false);

  if (removed) return null;

  async function unsubscribe() {
    setPending(true);
    try {
      const result = await unsubscribeDocument(subscription.targetId);
      if (!result.success) {
        toastActionError(toast, result, { action: "подписку" });
        return;
      }
      setRemoved(true);
    } finally {
      setPending(false);
    }
  }

  // Бэк отдаёт только target_id (без названия) — показываем ссылку с префиксом id.
  // TODO(backend-ask): добавить название цели в подписку (Task 16).
  const label = `Документ ${subscription.targetId.slice(0, 8)}`;

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      {subscription.targetType === "document" ? (
        <RouterLink
          href={`/documents/${subscription.targetId}`}
          className="text-sm text-(--color-link)"
        >
          {label}
        </RouterLink>
      ) : (
        <span className="text-sm">
          {subscription.targetType} {subscription.targetId.slice(0, 8)}
        </span>
      )}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          void unsubscribe();
        }}
      >
        Отписаться
      </Button>
    </li>
  );
}
