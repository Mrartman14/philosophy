// src/features/banners/display.test.ts
import { describe, it, expect } from "vitest";

import {
  audienceLabel,
  formatBannerDate,
  formatBannerPeriod,
  toColorInputValue,
  bannerPreviewText,
} from "./display";
import type { Banner } from "./types";

describe("audienceLabel", () => {
  it("известная аудитория → русская метка", () => {
    expect(audienceLabel("all")).toBe("Всем");
    expect(audienceLabel("authenticated")).toBe("Авторизованным");
    expect(audienceLabel("admin")).toBe("Администраторам");
  });
  it("undefined → пустая строка", () => {
    expect(audienceLabel(undefined)).toBe("");
  });
});

describe("formatBannerDate", () => {
  it("RFC3339 → локализованная дата со временем (UTC)", () => {
    const s = formatBannerDate("2026-07-01T19:00:00Z");
    expect(s).toContain("2026");
    expect(s).toMatch(/19:00/);
  });
  it("пустое значение → пустая строка", () => {
    expect(formatBannerDate(undefined)).toBe("");
  });
  it("непарсибельное значение возвращается как есть", () => {
    expect(formatBannerDate("garbage")).toBe("garbage");
  });
});

describe("formatBannerPeriod", () => {
  it("обе даты → «с … по …»", () => {
    const s = formatBannerPeriod("2026-07-01T10:00:00Z", "2026-07-02T10:00:00Z");
    expect(s.startsWith("с ")).toBe(true);
    expect(s).toContain(" по ");
  });
  it("только начало → «с …» без «по»", () => {
    const s = formatBannerPeriod("2026-07-01T10:00:00Z", undefined);
    expect(s.startsWith("с ")).toBe(true);
    expect(s).not.toContain(" по ");
  });
  it("нет начала → пустая строка", () => {
    expect(formatBannerPeriod(undefined, "2026-07-02T10:00:00Z")).toBe("");
  });
});

describe("toColorInputValue", () => {
  it("#abc разворачивается в #aabbcc", () => {
    expect(toColorInputValue("#abc")).toBe("#aabbcc");
  });
  it("#AABBCC приводится к нижнему регистру", () => {
    expect(toColorInputValue("#AABBCC")).toBe("#aabbcc");
  });
  it("undefined → fallback", () => {
    expect(toColorInputValue(undefined)).toBe("#336699");
  });
  it("мусор → fallback", () => {
    expect(toColorInputValue("red")).toBe("#336699");
  });
});

describe("bannerPreviewText", () => {
  it("склеивает text блоков через пробел", () => {
    const blocks: Banner["blocks"] = [{ text: "Привет" }, { text: "мир" }];
    expect(bannerPreviewText(blocks)).toBe("Привет мир");
  });
  it("пустые blocks → пустая строка", () => {
    expect(bannerPreviewText([])).toBe("");
    expect(bannerPreviewText(undefined)).toBe("");
  });
  it("обрезает длинный текст с многоточием", () => {
    const blocks: Banner["blocks"] = [{ text: "a".repeat(200) }];
    const s = bannerPreviewText(blocks, 120);
    expect(s.length).toBe(121); // 120 символов + "…"
    expect(s.endsWith("…")).toBe(true);
  });
});
