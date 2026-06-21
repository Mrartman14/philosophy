"use client";
import { useEffect, useRef, useState } from "react";

import { useAppearance } from "@/components/appearance";
import { useT } from "@/i18n/client";
import { CONTRAST_PAIRS } from "@/styles/tokens/apca-targets";

import { srgbToY, apcaContrast } from "./apca-lc";

// module-level (outside component): 1px canvas resolver — конвертит ЛЮБОЙ CSS-цвет (oklch/oklab/color/rgb) в sRGB 0..255
let _ctx: CanvasRenderingContext2D | null | undefined;
function cssToRgb(color: string): [number, number, number] | null {
  if (typeof document === "undefined") return null;
  if (_ctx === undefined) {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    _ctx = c.getContext("2d", { colorSpace: "srgb" });
  }
  if (!_ctx) return null;
  _ctx.fillStyle = color;
  _ctx.fillRect(0, 0, 1, 1);
  const d = _ctx.getImageData(0, 0, 1, 1, { colorSpace: "srgb" }).data;
  return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
}

export function ApcaMatrix() {
  const { appearance } = useAppearance();
  const t = useT("design");
  const rootRef = useRef<HTMLUListElement>(null);
  const [lcs, setLcs] = useState<(number | null)[]>(() => CONTRAST_PAIRS.map(() => null));
  const [ran, setRan] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const recompute = () => {
      setLcs(
        CONTRAST_PAIRS.map((_, i) => {
          const fgEl = root.querySelector<HTMLElement>(`[data-i="${i}"] [data-fg]`);
          const bgEl = root.querySelector<HTMLElement>(`[data-i="${i}"] [data-bg]`);
          if (!fgEl || !bgEl) return null;
          const fg = cssToRgb(getComputedStyle(fgEl).color);
          const bg = cssToRgb(getComputedStyle(bgEl).backgroundColor);
          return fg && bg ? apcaContrast(srgbToY(fg), srgbToY(bg)) : null;
        }),
      );
      setRan(true);
    };
    recompute();
    const mqs = [
      window.matchMedia("(prefers-color-scheme: dark)"),
      window.matchMedia("(prefers-contrast: more)"),
    ];
    mqs.forEach((m) => { m.addEventListener("change", recompute); });
    return () => { mqs.forEach((m) => { m.removeEventListener("change", recompute); }); };
  }, [appearance.theme, appearance.contrast]);

  const allNull = lcs.every((x) => x == null);

  return (
    <>
    {ran && allNull ? (
      <p className="text-sm text-(--color-danger)">{t("matrixUnavailable")}</p>
    ) : null}
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
            {/* p.note намеренно остаётся английским техническим лейблом (зеркалит лейблы пар в CI-гарде):
                динамический ключ t(`notes.${fg}__${bg}`) не типизируется при strict typed-messages
                (декартово произведение ColorTokenName × ColorTokenName даёт ~900 несуществующих ключей). */}
            <span className="text-xs text-(--color-fg-subtle)">{p.note}</span>
          </li>
        );
      })}
    </ul>
    </>
  );
}
