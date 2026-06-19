import { describe, it, expect } from "vitest";
import { COLOR_LAYERS, buildColorLayer } from "./semantic";
import { CONTRAST_PAIRS, type ColorTokenName } from "./apca-targets";

const ALL: ColorTokenName[] = [
  "surface","surface-subtle","surface-raised","surface-overlay","fg","fg-muted","fg-subtle","fg-on-accent",
  "border","border-strong","ring","accent","accent-hover","accent-fg","link","link-hover",
  "danger","danger-bg","danger-fg","success","success-bg","success-fg",
  "warning","warning-bg","warning-fg","info","info-bg","info-fg",
];

describe("semantic color layers", () => {
  it("defines all 4 combos", () => {
    expect(Object.keys(COLOR_LAYERS).sort()).toEqual(["dark-high","dark-normal","light-high","light-normal"].sort());
  });
  it("every layer defines every token as oklch", () => {
    for (const layer of Object.values(COLOR_LAYERS))
      for (const t of ALL) expect(layer[t], t).toMatch(/^oklch\(/);
  });
  it("high differs from normal", () => {
    const n = buildColorLayer("light","normal"), h = buildColorLayer("light","high");
    expect(ALL.some((t) => n[t] !== h[t])).toBe(true);
  });
  it("CONTRAST_PAIRS reference only known tokens", () => {
    const names = new Set(ALL);
    for (const p of CONTRAST_PAIRS) { expect(names.has(p.fg)).toBe(true); expect(names.has(p.bg)).toBe(true); }
  });
});
