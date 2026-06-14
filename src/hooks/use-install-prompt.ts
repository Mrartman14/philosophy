"use client";

import { useEffect, useRef, useState } from "react";

interface UseInstallPromptReturn {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<void>;
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of static browser API on mount
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        // navigator.platform kept for iOS PWA detection; navigator.userAgentData.platform not yet universally supported (no longer flagged @deprecated as of TS 6 lib.dom)
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => { window.removeEventListener("beforeinstallprompt", handler); };
  }, []);

  const promptInstall = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
    deferredPromptRef.current = null;
  };

  return { canInstall, isIOS, isStandalone, promptInstall };
}

// Type augmentation for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
