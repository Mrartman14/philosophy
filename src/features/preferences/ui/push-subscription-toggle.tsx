"use client";
// src/features/preferences/ui/push-subscription-toggle.tsx
import { useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";
import { log } from "@/services/observability/client";

import { subscribePush, unsubscribePush } from "../actions";
import { urlBase64ToUint8Array } from "../vapid";

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
  const t = useT("preferences");
  const tErrors = useT("errors");
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
            ? tErrors("forbiddenAction", { action: t("pushSubscribeAction") })
            : result.error,
        );
        return;
      }
      setState({ phase: "ready", subscribed: true });
    } catch {
      if (Notification.permission === "denied") {
        setState({ phase: "denied" });
      } else {
        setError(t("pushSubscribeError"));
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
          log.error("[push] server unsubscribe failed", { error: result.error });
        }
      }
      setState({ phase: "ready", subscribed: false });
    } catch {
      setError(t("pushUnsubscribeError"));
    } finally {
      setPending(false);
    }
  };

  if (state.phase === "loading") {
    return (
      <p className="text-sm text-(--color-fg-muted)">{t("pushCheckingSubscription")}</p>
    );
  }
  if (state.phase === "unsupported") {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        {t("pushUnsupported")}
      </p>
    );
  }
  if (state.phase === "denied") {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        {t("pushDenied")}
      </p>
    );
  }
  if (vapidPublicKey === null) {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        {t("pushUnavailable")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {state.subscribed
          ? t("pushSubscribed")
          : t("pushNotSubscribed")}
      </p>
      {state.subscribed ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={pending}
          onClick={() => { void handleUnsubscribe(); }}
        >
          {t("pushUnsubscribeButton")}
        </Button>
      ) : (
        <Button
          className="self-start"
          disabled={pending || !canSubscribe}
          onClick={() => { void handleSubscribe(); }}
        >
          {t("pushSubscribeButton")}
        </Button>
      )}
      {!canSubscribe && !state.subscribed && (
        <p className="text-sm text-(--color-fg-muted)">
          {tErrors("forbiddenAction", { action: t("pushSubscribeAction") })}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
