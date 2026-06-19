"use client";

import { createContext, useCallback, useContext, useState } from "react";

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

export function AppearanceProvider({ initial, children }: { initial: Appearance; children: React.ReactNode }) {
  const [appearance, setAppearance] = useState(initial);
  const setAxis = useCallback<Ctx["setAxis"]>((k, v) => {
    setAppearance((prev) => {
      const next = { ...prev, [k]: v };
      applyToHtml(next);
      document.cookie = `${APPEARANCE_COOKIE}=${encodeURIComponent(serializeAppearance(next))}; path=/; max-age=31536000; samesite=lax`;
      void persistAppearance(next);
      return next;
    });
  }, []);
  return <AppearanceContext.Provider value={{ appearance, setAxis }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
