import { describe, expect, it } from "vitest";

import { resolveBackgroundGesture, resolveNodeGesture, resolveWheel, resolveNudge } from "./interaction";

const base = { tool: "select" as const, spaceHeld: false, button: 0, pointerType: "mouse", shift: false };

describe("resolveBackgroundGesture", () => {
  it("select + левая мышь → marquee", () => {
    expect(resolveBackgroundGesture(base)).toBe("marquee");
  });
  it("hand-tool → pan", () => {
    expect(resolveBackgroundGesture({ ...base, tool: "hand" })).toBe("pan");
  });
  it("зажатый Space → pan", () => {
    expect(resolveBackgroundGesture({ ...base, spaceHeld: true })).toBe("pan");
  });
  it("средняя кнопка → pan", () => {
    expect(resolveBackgroundGesture({ ...base, button: 1 })).toBe("pan");
  });
  it("тач одним пальцем → pan (не marquee)", () => {
    expect(resolveBackgroundGesture({ ...base, pointerType: "touch" })).toBe("pan");
  });
});

describe("resolveNodeGesture", () => {
  it("select → select-move", () => {
    expect(resolveNodeGesture(base)).toBe("select-move");
  });
  it("hand/Space/средняя → pan", () => {
    expect(resolveNodeGesture({ ...base, tool: "hand" })).toBe("pan");
    expect(resolveNodeGesture({ ...base, spaceHeld: true })).toBe("pan");
    expect(resolveNodeGesture({ ...base, button: 1 })).toBe("pan");
  });
});

describe("resolveWheel", () => {
  it("ctrl/meta → zoom (вверх = увеличение)", () => {
    expect(resolveWheel({ deltaX: 0, deltaY: -10, ctrlKey: true, metaKey: false, shiftKey: false })).toEqual({ kind: "zoom", factor: 1.1 });
    expect(resolveWheel({ deltaX: 0, deltaY: 10, ctrlKey: false, metaKey: true, shiftKey: false })).toEqual({ kind: "zoom", factor: 1 / 1.1 });
  });
  it("плоское колесо → pan по дельтам", () => {
    expect(resolveWheel({ deltaX: 5, deltaY: 12, ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ kind: "pan", dx: 5, dy: 12 });
  });
  it("shift без deltaX → горизонтальный pan", () => {
    expect(resolveWheel({ deltaX: 0, deltaY: 15, ctrlKey: false, metaKey: false, shiftKey: true })).toEqual({ kind: "pan", dx: 15, dy: 0 });
  });
});

describe("resolveNudge", () => {
  it("стрелки без shift → 1px со знаком", () => {
    expect(resolveNudge("ArrowLeft", false)).toEqual({ dx: -1, dy: 0 });
    expect(resolveNudge("ArrowRight", false)).toEqual({ dx: 1, dy: 0 });
    expect(resolveNudge("ArrowUp", false)).toEqual({ dx: 0, dy: -1 });
    expect(resolveNudge("ArrowDown", false)).toEqual({ dx: 0, dy: 1 });
  });
  it("shift → 10px", () => {
    expect(resolveNudge("ArrowDown", true)).toEqual({ dx: 0, dy: 10 });
  });
  it("не-стрелка → null", () => {
    expect(resolveNudge("Enter", false)).toBeNull();
  });
});
