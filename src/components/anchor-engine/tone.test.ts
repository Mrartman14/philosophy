import { describe, expect, it } from "vitest";

import { toneColor } from "./tone";

describe("toneColor", () => {
  it("comment → var(--color-link)", () => {
    expect(toneColor("comment")).toBe("var(--color-link)");
  });
  it("annotation → var(--color-highlight-active)", () => {
    expect(toneColor("annotation")).toBe("var(--color-highlight-active)");
  });
});
