"use client";

import { useEffect, useState } from "react";
import { pushService } from "@/services/push-service/push-service";

type UsePushSubscriptionReturn = {
  isSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      pushService.getSubscription().then(setSubscription);
    }
  }, []);

  const subscribe = async () => {
    const sub = await pushService.subscribe();
    setSubscription(sub);
    setPermission(Notification.permission);
  };

  const unsubscribe = async () => {
    await pushService.unsubscribe();
    setSubscription(null);
  };

  return { isSupported, permission, subscription, subscribe, unsubscribe };
}
