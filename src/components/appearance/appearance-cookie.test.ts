import { describe, it, expect } from "vitest";

import { THEME_COLOR } from "@/styles/theme-color.generated";

import { DEFAULT_APPEARANCE, parseAppearance, serializeAppearance, htmlAttrs, themeColorMeta } from "./appearance-cookie";

describe("appearance-cookie", () => {
  it("defaults on undefined/garbage", () => {
    expect(parseAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("not-json")).toEqual(DEFAULT_APPEARANCE);
  });
  it("round-trips valid appearance", () => {
    const a = { theme: "dark", contrast: "high", density: "compact", font: "serif", textSize: "lg", motion: "reduced", textAlign: "justify" } as const;
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
  });
  it("round-trips motion: full", () => {
    const a = { ...DEFAULT_APPEARANCE, motion: "full" } as const;
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
  });
  it("coerces unknown per field", () => {
    const a = parseAppearance(JSON.stringify({ theme: "neon", textSize: "huge" }));
    expect(a.theme).toBe("system"); expect(a.textSize).toBe("md");
  });
  it("htmlAttrs omits data-theme for system (color-scheme через CSS, не inline)", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "system" })["data-theme"]).toBeUndefined();
    expect("colorScheme" in htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "system" })).toBe(false);
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "dark" })["data-theme"]).toBe("dark");
  });
  it("htmlAttrs maps textSize → data-text-size (md опущен, без inline-style)", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, textSize: "xl" })["data-text-size"]).toBe("xl");
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, textSize: "md" })["data-text-size"]).toBeUndefined();
    expect("style" in htmlAttrs({ ...DEFAULT_APPEARANCE, textSize: "xl" })).toBe(false);
  });
  it("htmlAttrs: auto contrast omits data-contrast (OS boost applies); explicit normal/high emit it (opt-out/force)", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, contrast: "auto" })["data-contrast"]).toBeUndefined();
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, contrast: "normal" })["data-contrast"]).toBe("normal");
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, contrast: "high" })["data-contrast"]).toBe("high");
  });
  it("htmlAttrs: system motion omits data-motion; reduced/full emit it", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, motion: "system" })["data-motion"]).toBeUndefined();
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, motion: "reduced" })["data-motion"]).toBe("reduced");
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, motion: "full" })["data-motion"]).toBe("full");
  });
  it("parseAppearance coerces unknown motion → system and defaults to system", () => {
    expect(parseAppearance(JSON.stringify({ motion: "warp" })).motion).toBe("system");
    expect(DEFAULT_APPEARANCE.motion).toBe("system");
  });

  // textAlign: ось чтения start|justify. Значения ЛОГИЧЕСКИЕ (start/justify), не
  // физические (left/right), поэтому RTL не требует спец-обработки. Дефолт start.
  it("round-trips textAlign: justify", () => {
    const a = { ...DEFAULT_APPEARANCE, textAlign: "justify" } as const;
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
  });
  it("coerces unknown textAlign → start and defaults to start", () => {
    // Намеренно подаём физическое "left" — оно НЕ в enum (start|justify), parser
    // обязан схлопнуть его в start. Это и есть RTL-инвариант (физических значений
    // нет в контракте). eslint-disable — это тест-данные, а не реальный style-проп.
    // eslint-disable-next-line no-restricted-syntax -- проверяем коэрсинг запрещённого физического значения
    expect(parseAppearance(JSON.stringify({ textAlign: "left" })).textAlign).toBe("start");
    expect(parseAppearance(JSON.stringify({ textAlign: "centered" })).textAlign).toBe("start");
    expect(DEFAULT_APPEARANCE.textAlign).toBe("start");
  });
  it("htmlAttrs: start textAlign omits data-align (дефолт-поток); justify emits it", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, textAlign: "start" })["data-align"]).toBeUndefined();
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, textAlign: "justify" })["data-align"]).toBe("justify");
  });

  // theme-color: при ЯВНОЙ теме хром браузера фиксирован под surface этой темы
  // (не зависит от ОС); при system — отдаём пару под prefers-color-scheme.
  it("themeColorMeta: explicit light/dark → single fixed color matching the surface", () => {
    expect(themeColorMeta({ ...DEFAULT_APPEARANCE, theme: "light" })).toEqual({ type: "fixed", color: THEME_COLOR.light });
    expect(themeColorMeta({ ...DEFAULT_APPEARANCE, theme: "dark" })).toEqual({ type: "fixed", color: THEME_COLOR.dark });
  });
  it("themeColorMeta: system → adaptive pair (OS prefers-color-scheme decides)", () => {
    expect(themeColorMeta({ ...DEFAULT_APPEARANCE, theme: "system" })).toEqual({ type: "adaptive", light: THEME_COLOR.light, dark: THEME_COLOR.dark });
  });
  it("themeColorMeta: contrast does not change the color (surface is contrast-invariant)", () => {
    expect(themeColorMeta({ ...DEFAULT_APPEARANCE, theme: "dark", contrast: "high" })).toEqual({ type: "fixed", color: THEME_COLOR.dark });
  });
});
