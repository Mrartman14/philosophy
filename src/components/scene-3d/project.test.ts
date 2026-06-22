import { describe, it, expect } from "vitest";

import { projectToScreen } from "./project";

// Column-major identity 4x4.
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe("projectToScreen", () => {
  it("identity: центр NDC → центр экрана", () => {
    const s = projectToScreen([0, 0, 0], I, 200, 100);
    expect(s.x).toBeCloseTo(100, 5);
    expect(s.y).toBeCloseTo(50, 5);
    expect(s.visible).toBe(true);
  });
  it("y инвертируется (экранный верх)", () => {
    const top = projectToScreen([0, 0.5, 0], I, 200, 100);
    expect(top.y).toBeLessThan(50); // выше центра
  });
  it("точка вне куба NDC → невидима", () => {
    const s = projectToScreen([5, 0, 0], I, 200, 100);
    expect(s.visible).toBe(false);
  });
  it("w=0 → невидима, без NaN", () => {
    const zeroW = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const s = projectToScreen([1, 1, 1], zeroW, 200, 100);
    expect(s.visible).toBe(false);
  });
});
