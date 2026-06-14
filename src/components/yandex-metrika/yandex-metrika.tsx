"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type YmFn = (counterId: number, action: string, ...params: unknown[]) => void;

declare global {
  interface Window {
    ym?: YmFn & { a?: unknown[][]; l?: number };
  }
}

const YM_COUNTER_ID = Number(
  process.env.NEXT_PUBLIC_YM_COUNTER_ID ?? 104376496,
);

export const YandexMetrika: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (window.ym) return;

    const stub = function (...args: unknown[]) {
      (stub.a = stub.a ?? []).push(args);
    } as YmFn & { a?: unknown[][]; l: number };
    stub.l = Date.now();
    window.ym = stub;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://mc.yandex.ru/metrika/tag.js";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);

    window.ym(YM_COUNTER_ID, "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });
  }, []);

  useEffect(() => {
    if (window.ym && pathname) {
      window.ym(YM_COUNTER_ID, "hit", pathname);
    }
  }, [pathname]);

  return null;
};
