import { describe, it, expect, beforeEach, vi } from "vitest";

import { HighlightController } from "./highlight-controller";

class FakeHighlight {
  ranges: Range[];
  constructor(...r: Range[]) {
    this.ranges = r;
  }
}

function install(): Map<string, FakeHighlight> {
  const s = new Map<string, FakeHighlight>();
  vi.stubGlobal("Highlight", FakeHighlight);
  vi.stubGlobal("CSS", { highlights: s });
  return s;
}

describe("HighlightController", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("supported + apply регистрирует", () => {
    const s = install();
    const c = new HighlightController();
    expect(c.supported).toBe(true);
    c.apply([document.createRange()]);
    expect(s.has("annotation")).toBe(true);
  });

  it("setActive отдельным слоем; null снимает", () => {
    const s = install();
    const c = new HighlightController();
    c.setActive(document.createRange());
    expect(s.has("annotation-active")).toBe(true);
    c.setActive(null);
    expect(s.has("annotation-active")).toBe(false);
  });

  it("clear снимает оба", () => {
    const s = install();
    const c = new HighlightController();
    c.apply([document.createRange()]);
    c.setActive(document.createRange());
    c.clear();
    expect(s.has("annotation")).toBe(false);
    expect(s.has("annotation-active")).toBe(false);
  });

  it("без CSS.highlights → supported=false, no-throw", () => {
    vi.stubGlobal("CSS", {});
    const c = new HighlightController();
    expect(c.supported).toBe(false);
    expect(() => {
      c.apply([document.createRange()]);
      c.setActive(null);
      c.clear();
    }).not.toThrow();
  });
});
