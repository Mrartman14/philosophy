"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    ym?: (...args: any[]) => void;
  }
}

const YM_COUNTER_ID = 104376496 as const;

export const YandexMetrika: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.ym) {
      (function (m: any, e: Document, t: string, r: string, i: string) {
        (m as any)[i] =
          (m as any)[i] ||
          function (...args: any[]) {
            ((m as any)[i].a = (m as any)[i].a || []).push(args);
          };
        (m as any)[i].l = Date.now();
        const k = e.createElement(t) as HTMLScriptElement;
        const a = e.getElementsByTagName(t)[0];
        k.async = true;
        k.src = r;
        a?.parentNode?.insertBefore(k, a);
      })(
        window,
        document,
        "script",
        "https://mc.yandex.ru/metrika/tag.js",
        "ym"
      );
      window.ym!(YM_COUNTER_ID, "init", {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
    }
  }, []);

  useEffect(() => {
    if (window.ym && pathname) {
      window.ym(YM_COUNTER_ID, "hit", pathname);
    }
  }, [pathname]);

  return null;
};
