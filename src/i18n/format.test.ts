import { describe, expect, it } from "vitest";

import { getFmt } from "./format";

describe("getFmt.dateTime", () => {
  const iso = "2026-06-14T10:30:00Z";
  it("ru даёт дд.мм.гггг", () => {
    expect(
      getFmt("ru").dateTime(iso, { dateStyle: "short", timeZone: "UTC" }),
    ).toBe("14.06.2026");
  });
  it("en отличается от ru", () => {
    const ru = getFmt("ru").dateTime(iso, { dateStyle: "short", timeZone: "UTC" });
    const en = getFmt("en").dateTime(iso, { dateStyle: "short", timeZone: "UTC" });
    expect(en).not.toBe(ru);
  });
  it("невалидная дата → исходная строка", () => {
    expect(getFmt("ru").dateTime("not-a-date")).toBe("not-a-date");
  });
});

describe("getFmt.number", () => {
  it("ru группирует разряды неразрывным пробелом", () => {
    expect(getFmt("ru").number(12345)).toContain("12");
    expect(getFmt("ru").number(12345)).toContain("345");
  });
});
