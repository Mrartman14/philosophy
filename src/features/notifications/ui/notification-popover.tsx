"use client";
// src/features/notifications/ui/notification-popover.tsx
import { useEffect, useState } from "react";

import { RouterLink } from "@/components/ui";

import { fetchNotifications, markAllSeen } from "../actions";
import type { AppNotification } from "../types";

import { NotificationItem } from "./notification-item";

interface NotificationPopoverProps {
  onClose: () => void;
  /** Вызывается после попытки markAllSeen (оптимистично) — родитель гасит бейдж. */
  onSeen: () => void;
}

export function NotificationPopover({ onClose, onSeen }: NotificationPopoverProps) {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetchNotifications({ offset: 0, limit: 10 });
      if (cancelled) return;
      if (!result.success) {
        setError(true);
        return;
      }
      setItems(result.data.items);
      // Гасим бейдж: помечаем всё просмотренным при открытии.
      void markAllSeen().then(() => {
        if (!cancelled) onSeen();
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [onSeen]);

  return (
    <div role="dialog" aria-label="Уведомления" className="absolute right-0 top-full z-50 mt-2 flex w-80 max-w-[90vw] flex-col rounded border border-(--color-border) bg-(--color-surface) shadow-lg">
      <div className="flex items-center justify-between border-b border-(--color-border) px-3 py-2">
        <span className="text-sm font-semibold">Уведомления</span>
        <RouterLink
          href="/me/notifications"
          className="text-xs text-(--color-link)"
          onClick={onClose}
        >
          Все
        </RouterLink>
      </div>
      <div className="flex max-h-96 flex-col overflow-y-auto p-1">
        {items === null && !error && (
          <p className="px-3 py-4 text-sm text-(--color-fg-muted)">Загрузка…</p>
        )}
        {error && (
          <p className="px-3 py-4 text-sm text-(--color-fg-muted)">
            Не удалось загрузить уведомления.
          </p>
        )}
        {items !== null && items.length === 0 && (
          <p className="px-3 py-4 text-sm text-(--color-fg-muted)">
            Пока нет уведомлений.
          </p>
        )}
        {items?.map((n) => (
          <NotificationItem key={n.id} notification={n} onNavigate={onClose} />
        ))}
      </div>
    </div>
  );
}
