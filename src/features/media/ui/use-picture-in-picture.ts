"use client";
// src/features/media/ui/use-picture-in-picture.ts
import { useCallback, useEffect, useState, type RefObject } from "react";

const PIP = "picture-in-picture";

/** WebKit PiP (Safari/iOS) — нет в lib.dom, узкий локальный тип. */
interface WebkitVideo {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

function standardSupported(el: HTMLMediaElement): boolean {
  return (
    typeof document !== "undefined" &&
    document.pictureInPictureEnabled &&
    !(el as HTMLVideoElement).disablePictureInPicture
  );
}

function webkitSupported(el: HTMLMediaElement): boolean {
  const w = el as unknown as WebkitVideo;
  return (
    typeof w.webkitSupportsPresentationMode === "function" &&
    w.webkitSupportsPresentationMode(PIP)
  );
}

function isActive(el: HTMLMediaElement): boolean {
  const w = el as unknown as WebkitVideo;
  return (
    (typeof document !== "undefined" && document.pictureInPictureElement === el) ||
    w.webkitPresentationMode === PIP
  );
}

/**
 * Picture-in-Picture для видео: стандартный API + WebKit-fallback (iOS Safari).
 * Прогрессивное улучшение — `supported=false` без поддержки. Слушатели снимаются
 * на unmount.
 */
export function usePictureInPicture(
  videoRef: RefObject<HTMLMediaElement | null>,
): { supported: boolean; active: boolean; toggle: () => void } {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const std = standardSupported(el);
    const wk = webkitSupported(el);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time feature-detect of static PiP browser APIs on mount
    setSupported(std || wk);
    if (!std && !wk) return;

    const sync = (): void => {
      setActive(isActive(el));
    };
    sync();
    el.addEventListener("enterpictureinpicture", sync);
    el.addEventListener("leavepictureinpicture", sync);
    el.addEventListener("webkitpresentationmodechanged", sync);

    return () => {
      el.removeEventListener("enterpictureinpicture", sync);
      el.removeEventListener("leavepictureinpicture", sync);
      el.removeEventListener("webkitpresentationmodechanged", sync);
    };
  }, [videoRef]);

  const toggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const w = el as unknown as WebkitVideo;

    if (isActive(el)) {
      if (typeof document !== "undefined" && document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {
          /* выход не удался — игнор */
        });
      } else if (typeof w.webkitSetPresentationMode === "function") {
        w.webkitSetPresentationMode("inline");
      }
      return;
    }

    if (standardSupported(el) && "requestPictureInPicture" in el) {
      (el as HTMLVideoElement).requestPictureInPicture().catch(() => {
        /* запрос отклонён (нет метаданных/запрет) — игнор */
      });
    } else if (typeof w.webkitSetPresentationMode === "function") {
      w.webkitSetPresentationMode(PIP);
    }
  }, [videoRef]);

  return { supported, active, toggle };
}
