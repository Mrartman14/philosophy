"use client";

import { useLayoutEffect, useState } from "react";

export type SWProviderState = {
  isSupported: boolean;
  setIsSupported: React.Dispatch<React.SetStateAction<boolean>>;
  subscription: PushSubscription | null;
  setSubscription: React.Dispatch<
    React.SetStateAction<PushSubscription | null>
  >;
};
type SWProviderProps = {
  children?: (state: SWProviderState) => React.ReactNode;
};
export const SWProvider: React.FC<SWProviderProps> = ({ children }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );

  useLayoutEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);

      async function registerServiceWorker() {
        // const registration = await navigator.serviceWorker.register(`./sw.js`, {
        //   scope: "/",
        //   updateViaCache: "none",
        // });
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const registration = await navigator.serviceWorker.register(
          `${basePath}/sw.js`,
          {
            type: "module",
            scope: `${basePath}/`,
            updateViaCache: "none",
          }
        );
        const sub = await registration.pushManager.getSubscription();
        setSubscription(sub);
      }
      registerServiceWorker();
    }
  }, []);

  const state: SWProviderState = {
    isSupported,
    setIsSupported,
    subscription,
    setSubscription,
  };

  return children?.(state) ?? null;
};
