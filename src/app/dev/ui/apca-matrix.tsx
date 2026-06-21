"use client";
import { useEffect, useRef, useState } from "react";

import { useAppearance } from "@/components/appearance";
import { CONTRAST_PAIRS } from "@/styles/tokens/apca-targets";

import { apcaLc } from "./apca-lc";

export function ApcaMatrix() {
  const { appearance } = useAppearance();
  const rootRef = useRef<HTMLUListElement>(null);
  const [lcs, setLcs] = useState<(number | null)[]>(() => CONTRAST_PAIRS.map(() => null));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const recompute = () => {
      setLcs(
        CONTRAST_PAIRS.map((_, i) => {
          const fgEl = root.querySelector<HTMLElement>(`[data-i="${i}"] [data-fg]`);
          const bgEl = root.querySelector<HTMLElement>(`[data-i="${i}"] [data-bg]`);
          if (!fgEl || !bgEl) return null;
          return apcaLc(getComputedStyle(fgEl).color, getComputedStyle(bgEl).backgroundColor);
        }),
      );
    };
    recompute();
    const mqs = [
      window.matchMedia("(prefers-color-scheme: dark)"),
      window.matchMedia("(prefers-contrast: more)"),
    ];
    mqs.forEach((m) => { m.addEventListener("change", recompute); });
    return () => { mqs.forEach((m) => { m.removeEventListener("change", recompute); }); };
  }, [appearance.theme, appearance.contrast]);

  return (
    <ul ref={rootRef} className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {CONTRAST_PAIRS.map((p, i) => {
        const lc = lcs[i];
        const abs = lc == null ? null : Math.abs(lc);
        const pass = abs !== null && abs >= p.minLc;
        return (
          <li key={`${p.fg}-${p.bg}`} data-i={i} className="flex flex-col gap-1 rounded border border-(--color-border) p-2">
            <div
              data-bg
              className="flex h-12 items-center justify-center rounded"
              style={{ background: `var(--color-${p.bg})` }}
            >
              <span data-fg className="text-lg font-semibold" style={{ color: `var(--color-${p.fg})` }}>
                Aa
              </span>
            </div>
            <code className="text-xs text-(--color-fg-muted)">{p.fg} / {p.bg}</code>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono">{abs === null ? "—" : abs.toFixed(0)}</span>
              <span className="text-(--color-fg-muted)">/ {p.minLc}</span>
              <span className={pass ? "text-(--color-success)" : "text-(--color-danger)"}>
                {abs === null ? "" : pass ? "pass" : "FAIL"}
              </span>
            </div>
            <span className="text-xs text-(--color-fg-subtle)">{p.note}</span>
          </li>
        );
      })}
    </ul>
  );
}
