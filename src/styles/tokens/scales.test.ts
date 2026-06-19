import { describe, it, expect } from "vitest";
import { TYPE_SCALE, DENSITY, TEXT_SCALE, FONT_STACKS, Z } from "./scales";
import { THEMES, FONTS } from "./enums";

describe("enums", () => {
  it("expose axis value arrays", () => {
    expect(THEMES).toContain("system");
    expect(FONTS).toEqual(["sans", "legible", "serif"]);
  });
});

describe("scales", () => {
  it("type scale is monotonic in rem size", () => {
    const steps = ["2xs","xs","sm","base","lg","xl","2xl","3xl","4xl"] as const;
    const rems = steps.map((s) => parseFloat(TYPE_SCALE[s].size));
    for (let i = 1; i < rems.length; i++) expect(rems[i]!).toBeGreaterThan(rems[i - 1]!);
  });
  it("compact density tighter than comfortable", () => {
    expect(parseFloat(DENSITY.compact.controlH.md)).toBeLessThan(parseFloat(DENSITY.comfortable.controlH.md));
  });
  it("md text scale is neutral 1", () => { expect(TEXT_SCALE.md).toBe(1); });
  it("font stacks reference next/font vars", () => {
    expect(FONT_STACKS.sans).toContain("--font-geist-sans");
    expect(FONT_STACKS.legible).toContain("--font-atkinson");
    expect(FONT_STACKS.serif).toContain("--font-serif");
  });
  it("z toast above modal", () => { expect(Z.toast).toBeGreaterThan(Z.modal); });
});
