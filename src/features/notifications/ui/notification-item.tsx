"use client";
// src/features/notifications/ui/notification-item.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import { markRead, resolveCommentReplyHref } from "../actions";
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
  const [pending, setPending] = useState(false);
  const d = describeNotification(notification);

  let text: string;
  if (d.kind === "raw") {
    const base = t("fallback");
    text = d.count > 1 ? `${base} (${d.count})` : base;
  } else {
    // documentUpdated | lectureUpdated | canvasUpdated | commentReplied — ICU-plural по count (group_count)
    text = t(d.kind, { count: d.count });
  }

  async function handleClick() {
    if (pending) return; // не даём повторный клик во время резолва
    if (!read) {
      setRead(true); // оптимистично
      void markRead(notification.id); // ошибку игнорируем — некритично
    }
    // commentReplied: у коммента нет своей страницы — хост-лекцию резолвим по
    // клику (1 запрос на реальный переход вместо N+1 на рендере ленты).
    if (d.kind === "commentReplied") {
      if (!d.commentId) {
        onNavigate?.();
        return;
      }
      setPending(true);
      const result = await resolveCommentReplyHref(d.commentId);
      setPending(false);
      onNavigate?.();
      if (result.success && result.data) router.push(result.data);
      return;
    }
    onNavigate?.();
    if (d.href) router.push(d.href);
  }

  return (
    <Button
      unstyled
      onClick={() => void handleClick()}
      aria-busy={pending}
      className={`flex w-full items-start gap-2 rounded px-3 py-2 text-start text-sm hover:bg-(--color-surface-subtle) ${
        read ? "text-(--color-fg-muted)" : "font-medium"
      } ${pending ? "opacity-60" : ""}`}
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
