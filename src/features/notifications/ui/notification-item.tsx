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
    const base = d.text || t("fallback");
    text = d.count > 1 ? `${base} (${d.count})` : base;
  } else if (d.kind === "commentCreated") {
    text = t("commentCreated", { count: d.count });
  } else {
    // documentUpdated | commentReply | annotationCreated | mention
    text = t(d.kind);
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
      variant="ghost"
      onClick={handleClick}
      className={`w-full items-start justify-start px-3 py-2 text-left text-sm ${
        read ? "text-(--color-fg-muted)" : "font-medium"
      }`}
    >
      {!read && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-(--color-accent)"
          aria-hidden="true"
        />
      )}
      <span>{text}</span>
    </Button>
  );
}
