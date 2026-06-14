"use client";

import { useEffect, useRef, useState } from "react";

interface UseRegisterSWReturn {
  needsUpdate: boolean;
  applyUpdate: () => void;
}

export function useRegisterSW(): UseRegisterSWReturn {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

    navigator.serviceWorker
      .register(`${basePath}/sw.js`, {
        scope: `${basePath}/`,
        updateViaCache: "none",
      })
      .then((registration) => {
        // Check if there's already a waiting SW
        if (registration.waiting) {
          waitingRef.current = registration.waiting;
          setNeedsUpdate(true);
        }

        // Listen for new SW installing
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              waitingRef.current = newWorker;
              setNeedsUpdate(true);
            }
          });
        });
      })
      .catch((err: unknown) => { console.error("[SW] registration failed:", err); });

    // Reload on controller change (after SKIP_WAITING)
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
  };

  return { needsUpdate, applyUpdate };
}
