"use client";
// src/features/notifications/ui/notification-item.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import { markRead } from "../actions";
import { describeNotification } from "../notification-content";
import type { AppNotification } from "../types";

interface NotificationItemProps {
  notification: AppNotification;
  /** Вызывается перед переходом (напр. закрыть поповер). */
  onNavigate?: () => void;
}

export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const router = useRouter();
  const t = useT("notifications");
  const [read, setRead] = useState(notification.readAt !== null);
  const d = describeNotification(notification);
  const href = d.href;

  let text: string;
  if (d.kind === "raw") {
    const base = t("fallback");
    text = d.count > 1 ? `${base} (${d.count})` : base;
  } else {
    // documentUpdated | lectureUpdated | canvasUpdated — ICU-plural по count (group_count)
    text = t(d.kind, { count: d.count });
  }

  function handleClick() {
    if (!read) {
      setRead(true); // оптимистично
      void markRead(notification.id); // ошибку игнорируем — некритично
    }
    onNavigate?.();
    if (href) router.push(href);
  }

  return (
    <Button
      unstyled
      onClick={handleClick}
      className={`flex w-full items-start gap-2 rounded px-3 py-2 text-start text-sm hover:bg-(--color-surface-subtle) ${
        read ? "text-(--color-fg-muted)" : "font-medium"
      }`}
    >
      {!read && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-(--color-accent)"
          aria-hidden="true"
        />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>{text}</span>
        {notification.groupCount === 1 && notification.actorName && (
          <span className="text-xs font-normal text-(--color-fg-muted)">
            {t("byActor", { actor: notification.actorName })}
          </span>
        )}
      </span>
    </Button>
  );
}
