import { describe, it, expect } from "vitest";

import { dirForLocale, RTL_LOCALES } from "./locales";

describe("dirForLocale", () => {
  it("проектные локали — ltr", () => {
    expect(dirForLocale("ru")).toBe("ltr");
    expect(dirForLocale("en")).toBe("ltr");
  });
  it("RTL-языки — rtl", () => {
    for (const l of RTL_LOCALES) expect(dirForLocale(l)).toBe("rtl");
    expect(dirForLocale("ar")).toBe("rtl");
    expect(dirForLocale("fa")).toBe("rtl");
  });
  it("primary-subtag из BCP-47", () => {
    expect(dirForLocale("ar-EG")).toBe("rtl");
    expect(dirForLocale("en-US")).toBe("ltr");
  });
  it("мусор → ltr", () => {
    expect(dirForLocale("")).toBe("ltr");
    expect(dirForLocale("xx")).toBe("ltr");
    expect(dirForLocale("system")).toBe("ltr");
  });
});
