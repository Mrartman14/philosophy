// src/features/banners/display.test.ts
import { describe, it, expect } from "vitest";

import {
  audienceLabel,
  audienceOptions,
  formatBannerDate,
  formatBannerPeriod,
  toColorInputValue,
  bannerPreviewText,
} from "./display";
import type { Banner } from "./types";

describe("audienceLabel", () => {
  it("известная аудитория → русский дефолт (без переводчика)", () => {
    expect(audienceLabel("all")).toBe("Всем");
    expect(audienceLabel("authenticated")).toBe("Авторизованным");
    expect(audienceLabel("admin")).toBe("Администраторам");
  });
  it("undefined → пустая строка", () => {
    expect(audienceLabel(undefined)).toBe("");
  });
  it("с переводчиком → catalog-ключ", () => {
    const t = (key: string) => `[${key}]`;
    expect(audienceLabel("all", t)).toBe("[audienceAll]");
    expect(audienceLabel("authenticated", t)).toBe("[audienceAuthenticated]");
    expect(audienceLabel("admin", t)).toBe("[audienceAdmin]");
  });
});

describe("audienceOptions", () => {
  it("без переводчика → значения + русские дефолты", () => {
    expect(audienceOptions()).toEqual([
      { value: "all", label: "Всем" },
      { value: "authenticated", label: "Авторизованным" },
      { value: "admin", label: "Администраторам" },
    ]);
  });
  it("с переводчиком → ключи каталога", () => {
    const t = (key: string) => `[${key}]`;
    expect(audienceOptions(t).map((o) => o.label)).toEqual([
      "[audienceAll]",
      "[audienceAuthenticated]",
      "[audienceAdmin]",
    ]);
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
  it("с переводчиком → catalog-ключ шаблона + параметры", () => {
    const t = (key: string, params: { start: string; end?: string }) =>
      key === "periodFromTo" ? `[from ${params.start} to ${params.end}]` : `[from ${params.start}]`;
    const both = formatBannerPeriod("2026-07-01T10:00:00Z", "2026-07-02T10:00:00Z", "ru", t);
    expect(both.startsWith("[from ")).toBe(true);
    expect(both).toContain(" to ");
    const onlyStart = formatBannerPeriod("2026-07-01T10:00:00Z", undefined, "ru", t);
    expect(onlyStart.startsWith("[from ")).toBe(true);
    expect(onlyStart).not.toContain(" to ");
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
