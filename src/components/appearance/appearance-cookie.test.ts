import { describe, it, expect } from "vitest";

import { DEFAULT_APPEARANCE, parseAppearance, serializeAppearance, htmlAttrs } from "./appearance-cookie";

describe("appearance-cookie", () => {
  it("defaults on undefined/garbage", () => {
    expect(parseAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("not-json")).toEqual(DEFAULT_APPEARANCE);
  });
  it("round-trips valid appearance", () => {
    const a = { theme: "dark", contrast: "high", density: "compact", font: "serif", textSize: "lg" } as const;
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
  });
  it("coerces unknown per field", () => {
    const a = parseAppearance(JSON.stringify({ theme: "neon", textSize: "huge" }));
    expect(a.theme).toBe("system"); expect(a.textSize).toBe("md");
  });
  it("htmlAttrs omits data-theme for system, sets color-scheme", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "system" })["data-theme"]).toBeUndefined();
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "system" }).colorScheme).toBe("light dark");
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "dark" })["data-theme"]).toBe("dark");
  });
  it("htmlAttrs maps textSize → --text-scale", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, textSize: "xl" }).style["--text-scale"]).toBe("1.25");
  });
  it("htmlAttrs: auto contrast omits data-contrast (OS boost applies); explicit normal/high emit it (opt-out/force)", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, contrast: "auto" })["data-contrast"]).toBeUndefined();
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, contrast: "normal" })["data-contrast"]).toBe("normal");
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, contrast: "high" })["data-contrast"]).toBe("high");
  });
});
