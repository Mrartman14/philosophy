// src/features/banners/display.test.ts
import { describe, it, expect } from "vitest";

import {
  audienceLabel,
  audienceOptions,
  formatBannerDate,
  formatBannerPeriod,
  variantLabel,
  variantOptions,
  BANNER_VARIANT_CLASS,
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

describe("variantLabel", () => {
  it("известный вариант → русский дефолт (без переводчика)", () => {
    expect(variantLabel("info")).toBe("Информация");
    expect(variantLabel("danger")).toBe("Критично");
    expect(variantLabel("neutral")).toBe("Нейтральный");
  });
  it("undefined → пустая строка", () => {
    expect(variantLabel(undefined)).toBe("");
  });
  it("с переводчиком → catalog-ключ", () => {
    const t = (key: string) => `[${key}]`;
    expect(variantLabel("success", t)).toBe("[variantSuccess]");
    expect(variantLabel("brand", t)).toBe("[variantBrand]");
  });
});

describe("variantOptions", () => {
  it("без переводчика → все 6 вариантов в порядке enum + русские дефолты", () => {
    const opts = variantOptions();
    expect(opts.map((o) => o.value)).toEqual([
      "info",
      "success",
      "warning",
      "danger",
      "brand",
      "neutral",
    ]);
    expect(opts[0]).toEqual({ value: "info", label: "Информация" });
  });
  it("с переводчиком → ключи каталога", () => {
    const t = (key: string) => `[${key}]`;
    expect(variantOptions(t)[1]?.label).toBe("[variantSuccess]");
  });
});

describe("BANNER_VARIANT_CLASS", () => {
  it("маппит каждый вариант в статический класс banner--{v}", () => {
    expect(BANNER_VARIANT_CLASS.info).toBe("banner--info");
    expect(BANNER_VARIANT_CLASS.danger).toBe("banner--danger");
    expect(BANNER_VARIANT_CLASS.brand).toBe("banner--brand");
    expect(BANNER_VARIANT_CLASS.neutral).toBe("banner--neutral");
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
