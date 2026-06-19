"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { type Appearance, APPEARANCE_COOKIE, htmlAttrs, serializeAppearance } from "./appearance-cookie";
import { persistAppearance } from "./persist-appearance";

interface Ctx { appearance: Appearance; setAxis: <K extends keyof Appearance>(k: K, v: Appearance[K]) => void }
const AppearanceContext = createContext<Ctx | null>(null);

const DATA_KEYS = ["data-theme", "data-contrast", "data-density", "data-font"] as const;
function applyToHtml(a: Appearance) {
  const el = document.documentElement;
  const { style, colorScheme, ...rest } = htmlAttrs(a);
  const data = rest as Record<string, string>;
  for (const key of DATA_KEYS) { const v = data[key]; if (v) el.setAttribute(key, v); else el.removeAttribute(key); }
  el.style.setProperty("--text-scale", style["--text-scale"] ?? null);
  el.style.colorScheme = colorScheme;
}

function writeCookie(a: Appearance) {
  document.cookie = `${APPEARANCE_COOKIE}=${encodeURIComponent(serializeAppearance(a))}; path=/; max-age=31536000; samesite=lax; secure`;
}

function hasCookie() {
  return document.cookie.split("; ").some((c) => c.startsWith(`${APPEARANCE_COOKIE}=`));
}

export function AppearanceProvider({ initial, children }: { initial: Appearance; children: React.ReactNode }) {
  const [appearance, setAppearance] = useState(initial);
  const appearanceRef = useRef(appearance);

  // Seed the cookie once on mount if absent — e.g. a new device whose appearance
  // was seeded from the backend during SSR. Lets subsequent SSR use the fast
  // cookie path instead of re-fetching preferences every request.
  useEffect(() => {
    if (!hasCookie()) writeCookie(appearanceRef.current);
  }, []);

  const setAxis = useCallback<Ctx["setAxis"]>((k, v) => {
    const next = { ...appearanceRef.current, [k]: v };
    appearanceRef.current = next;
    applyToHtml(next);
    writeCookie(next);
    void persistAppearance(next);
    setAppearance(next);
  }, []);
  return <AppearanceContext.Provider value={{ appearance, setAxis }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
