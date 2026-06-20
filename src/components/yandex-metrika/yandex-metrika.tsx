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

// Аналитика отключена по умолчанию — это осознанное решение, а не баг.
// Трекинг без согласия пользователя = юридический риск (GDPR / 152-ФЗ), поэтому
// Метрика не грузится, пока нет consent-механизма. Включается только явным
// флагом, и возвращать её можно лишь вместе с opt-in согласием.
// Чертёж и обоснование: docs/analytics-consent.md
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "1";

export const YandexMetrika: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
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
      // webvisor (запись сессий) убран намеренно — высокий privacy-риск.
      webvisor: false,
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
    });
  }, []);

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    if (window.ym && pathname) {
      window.ym(YM_COUNTER_ID, "hit", pathname);
    }
  }, [pathname]);

  return null;
};
