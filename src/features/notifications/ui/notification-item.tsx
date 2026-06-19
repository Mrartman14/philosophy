"use client";
// src/features/notifications/ui/notification-item.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { markRead } from "../actions";
import { renderNotification } from "../notification-content";
import type { AppNotification } from "../types";

interface NotificationItemProps {
  notification: AppNotification;
  /** Вызывается перед переходом (напр. закрыть поповер). */
  onNavigate?: () => void;
}

export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const router = useRouter();
  const [read, setRead] = useState(notification.readAt !== null);
  const { text, href } = renderNotification(notification);

  function handleClick() {
    if (!read) {
      setRead(true); // оптимистично
      void markRead(notification.id); // ошибку игнорируем — некритично
    }
    onNavigate?.();
    if (href) router.push(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-start gap-2 rounded px-3 py-2 text-left text-sm hover:bg-(--color-surface-subtle) ${
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
    </button>
  );
}
