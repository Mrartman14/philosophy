"use client";

import { usePushSubscription } from "@/hooks/use-push-subscription";

function PushNotificationManager() {
  const { isSupported, permission, subscription, subscribe, unsubscribe } =
    usePushSubscription();

  if (!isSupported) {
    return (
      <p className="text-(--description)">
        Push-уведомления не поддерживаются в этом браузере.
      </p>
    );
  }

  if (permission === "denied") {
    return (
      <p className="text-(--description)">
        Уведомления заблокированы. Разрешите их в настройках браузера.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        {subscription
          ? "Вы подписаны на уведомления."
          : "Вы не подписаны на уведомления."}
      </p>
      {subscription ? (
        <button
          className="self-start px-4 py-2 rounded border border-(--border) hover:bg-(--text-pane)"
          onClick={unsubscribe}
        >
          Отписаться
        </button>
      ) : (
        <button
          className="self-start px-4 py-2 rounded border border-(--border) hover:bg-(--text-pane)"
          onClick={subscribe}
        >
          Подписаться
        </button>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Уведомления</h1>
      <PushNotificationManager />
    </div>
  );
}
