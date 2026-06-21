"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { TZ_COOKIE, FALLBACK_ZONE, serializeTzCookie, isValidZone, type TzCookie } from "@/utils/timezone";

const TzContext = createContext<string>(FALLBACK_ZONE);

/** Текущая resolved-зона (IANA). Вне провайдера — фолбэк. */
export function useTz(): string {
  return useContext(TzContext);
}

function writeCookie(c: TzCookie): void {
  document.cookie = `${TZ_COOKIE}=${encodeURIComponent(serializeTzCookie(c))}; path=/; max-age=31536000; samesite=lax; secure`;
}

/**
 * Держит resolved-зону. Первый рендер = серверное значение (совпадает с SSR →
 * без hydration mismatch). Если pref="system" — на mount уточняет браузерную
 * зону и, при отличии, обновляет состояние + пишет cookie (pref не трогает).
 */
export function TimezoneProvider({ initial, children }: { initial: TzCookie; children: ReactNode }) {
  const [resolved, setResolved] = useState(initial.resolved);
  const prefRef = useRef(initial.pref);

  useEffect(() => {
    if (prefRef.current !== "system") return;
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidZone(browser) && browser !== resolved) {
      // setState в эффекте здесь намеренно: браузерную зону НЕЛЬЗЯ читать во
      // время рендера (server≠client → hydration mismatch, который мы и чиним).
      // Коррекция допустима только пост-гидрационно, поэтому паттерн
      // «adjust state during render» неприменим. См. ut-task-4-brief.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration коррекция system-зоны (анти-mismatch)
      setResolved(browser);
      writeCookie({ pref: "system", resolved: browser });
    }
  }, [resolved]);

  return <TzContext.Provider value={resolved}>{children}</TzContext.Provider>;
}
