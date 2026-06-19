import { describe, it, expect } from "vitest";

import { TOKENS } from "./index";

describe("TOKENS", () => {
  it("bundles layers + scales", () => {
    expect(TOKENS.colorLayers["light-normal"].fg).toMatch(/^oklch\(/);
    expect(TOKENS.scales.TYPE_SCALE.base.size).toBe("1rem");
  });
});
