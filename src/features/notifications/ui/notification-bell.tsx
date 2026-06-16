"use client";
// src/features/notifications/ui/notification-bell.tsx
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchCounts } from "../actions";
import type { NotificationCounts } from "../types";

import { BellIcon } from "./bell-icon";
import { NotificationPopover } from "./notification-popover";

/** Интервал опроса счётчиков (мс). <60с → кэш Anthropic не при чём; это сетевой poll. */
const POLL_MS = 50_000;

interface NotificationBellProps {
  initialCounts: NotificationCounts;
}

export function NotificationBell({ initialCounts }: NotificationBellProps) {
  const [counts, setCounts] = useState(initialCounts);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Момент последнего локального «всё просмотрено» — против гонки с poll'ом. */
  const lastSeenRef = useRef(0);

  // Polling счётчиков + рефреш при возврате фокуса/вкладки.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const startedAt = Date.now();
      const result = await fetchCounts();
      if (cancelled || !result.success) return;
      setCounts((prev) => ({
        unread: result.data.unread,
        // Если пользователь погасил бейдж (markAllSeen) ПОКА летел этот запрос —
        // не поднимаем unseen обратно устаревшим ответом (бэк ещё не применил seen).
        unseen: lastSeenRef.current > startedAt ? prev.unseen : result.data.unseen,
      }));
    }
    const interval = setInterval(() => {
      void refresh();
    }, POLL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Закрытие dropdown по клику вне и Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSeen = useCallback(() => {
    lastSeenRef.current = Date.now();
    setCounts((c) => ({ ...c, unseen: 0 }));
  }, []);

  const badge =
    counts.unseen > 0 ? (counts.unseen > 99 ? "99+" : String(counts.unseen)) : null;

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        aria-label="Уведомления"
        aria-expanded={open}
        onClick={() => { setOpen((v) => !v); }}
        className="relative flex size-8 items-center justify-center text-(--color-description) hover:text-(--color-primary)"
      >
        <BellIcon className="size-5" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-(--color-primary) px-1 text-[10px] leading-4 text-(--color-background)">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <NotificationPopover onClose={() => { setOpen(false); }} onSeen={handleSeen} />
      )}
    </div>
  );
}
