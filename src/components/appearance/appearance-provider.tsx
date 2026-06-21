"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { type Appearance, APPEARANCE_COOKIE, htmlAttrs, serializeAppearance } from "./appearance-cookie";
import { persistAppearance } from "./persist-appearance";

interface Ctx { appearance: Appearance; setAxis: <K extends keyof Appearance>(k: K, v: Appearance[K]) => void }
const AppearanceContext = createContext<Ctx | null>(null);

const DATA_KEYS = ["data-theme", "data-contrast", "data-density", "data-font", "data-motion"] as const;
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

// Backend write-through is debounced: the UI + cookie update instantly, but rapid
// axis toggles coalesce into a single PATCH carrying the latest snapshot.
const PERSIST_DEBOUNCE_MS = 500;

export function AppearanceProvider({ initial, children }: { initial: Appearance; children: React.ReactNode }) {
  const [appearance, setAppearance] = useState(initial);
  const appearanceRef = useRef(appearance);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed the cookie once on mount if absent — e.g. a new device whose appearance
  // was seeded from the backend during SSR. Lets subsequent SSR use the fast
  // cookie path instead of re-fetching preferences every request. Cleanup cancels
  // any pending debounced persist on unmount.
  useEffect(() => {
    if (!hasCookie()) writeCookie(appearanceRef.current);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
  }, []);

  const setAxis = useCallback<Ctx["setAxis"]>((k, v) => {
    const next = { ...appearanceRef.current, [k]: v };
    appearanceRef.current = next;
    applyToHtml(next);   // instant re-theme
    writeCookie(next);   // instant same-device durability
    // debounced backend sync: coalesce a burst of changes into one PATCH of the latest state
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      void persistAppearance(appearanceRef.current);
    }, PERSIST_DEBOUNCE_MS);
    setAppearance(next);
  }, []);
  return <AppearanceContext.Provider value={{ appearance, setAxis }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
