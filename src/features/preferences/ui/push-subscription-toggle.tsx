"use client";
// src/features/preferences/ui/push-subscription-toggle.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { subscribePush, unsubscribePush } from "../actions";

/** Конвертация base64url VAPID-ключа в Uint8Array для PushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type ToggleState =
  | { phase: "loading" }
  | { phase: "unsupported" }
  | { phase: "denied" }
  | { phase: "ready"; subscribed: boolean };

interface PushSubscriptionToggleProps {
  /** Публичный VAPID-ключ с бекенда; null — push не сконфигурирован. */
  vapidPublicKey: string | null;
  /** canSubscribePush(me) со страницы (server component). */
  canSubscribe: boolean;
}

export function PushSubscriptionToggle({
  vapidPublicKey,
  canSubscribe,
}: PushSubscriptionToggleProps) {
  const [state, setState] = useState<ToggleState>({ phase: "loading" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState({ phase: "unsupported" });
      return;
    }
    if (Notification.permission === "denied") {
      setState({ phase: "denied" });
      return;
    }
    // SW регистрируется глобально в update-prompt.tsx (root layout) —
    // здесь только ждём готовности и читаем текущую подписку.
    let cancelled = false;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) {
          setState({ phase: "ready", subscribed: subscription !== null });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "unsupported" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async () => {
    if (!vapidPublicKey) return;
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });
      const result = await subscribePush(subscription.toJSON());
      if (!result.success) {
        // Бекенд не сохранил подписку — откатываем браузерную,
        // чтобы не осталось «полуподписанного» состояния.
        await subscription.unsubscribe();
        setError(
          result.code === "forbidden"
            ? "У вас нет прав на подписку на уведомления."
            : result.error,
        );
        return;
      }
      setState({ phase: "ready", subscribed: true });
    } catch {
      if (Notification.permission === "denied") {
        setState({ phase: "denied" });
      } else {
        setError("Не удалось оформить подписку. Попробуйте ещё раз.");
      }
    } finally {
      setPending(false);
    }
  };

  const handleUnsubscribe = async () => {
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const result = await unsubscribePush(endpoint);
        if (!result.success) {
          // Браузерная подписка уже снята; мёртвый endpoint бекенд зачистит
          // сам после неудачных доставок (fail_count / 410 Gone) —
          // пользователю это не показываем.
          console.error("[push] server unsubscribe failed:", result.error);
        }
      }
      setState({ phase: "ready", subscribed: false });
    } catch {
      setError("Не удалось отписаться. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  if (state.phase === "loading") {
    return (
      <p className="text-sm text-(--color-description)">Проверяем подписку…</p>
    );
  }
  if (state.phase === "unsupported") {
    return (
      <p className="text-sm text-(--color-description)">
        Push-уведомления не поддерживаются в этом браузере.
      </p>
    );
  }
  if (state.phase === "denied") {
    return (
      <p className="text-sm text-(--color-description)">
        Уведомления заблокированы. Разрешите их в настройках браузера.
      </p>
    );
  }
  if (vapidPublicKey === null) {
    return (
      <p className="text-sm text-(--color-description)">
        Push-уведомления временно недоступны.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {state.subscribed
          ? "Вы подписаны на уведомления."
          : "Вы не подписаны на уведомления."}
      </p>
      {state.subscribed ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={pending}
          onClick={() => { void handleUnsubscribe(); }}
        >
          Отписаться
        </Button>
      ) : (
        <Button
          className="self-start"
          disabled={pending || !canSubscribe}
          onClick={() => { void handleSubscribe(); }}
        >
          Подписаться
        </Button>
      )}
      {!canSubscribe && !state.subscribed && (
        <p className="text-sm text-(--color-description)">
          У вас нет прав на подписку на уведомления.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
