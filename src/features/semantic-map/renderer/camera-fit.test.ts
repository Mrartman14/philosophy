import { describe, it, expect } from "vitest";

import { fit2D, fit3D } from "./camera-fit";

describe("fit2D", () => {
  it("центрирует по bounds", () => {
    const f = fit2D([-2, -4, 0], [2, 4, 0], 1);
    expect(f.centerX).toBe(0);
    expect(f.centerY).toBe(0);
  });
  it("кадр покрывает и ширину, и высоту при широком aspect", () => {
    const aspect = 2;
    const f = fit2D([-1, -1, 0], [1, 1, 0], aspect); // worldW=worldH=2
    expect(f.halfH).toBeGreaterThanOrEqual(1); // высота 2 влезает (2*halfH>=2)
    expect(f.halfH * aspect).toBeGreaterThanOrEqual(1); // ширина 2 влезает (2*halfH*aspect>=2)
  });
  it("не делит на ноль на вырожденных bounds", () => {
    const f = fit2D([0, 0, 0], [0, 0, 0], 1);
    expect(Number.isFinite(f.halfH)).toBe(true);
    expect(f.halfH).toBeGreaterThan(0);
  });
});

describe("fit3D", () => {
  it("центр — середина bounds, дистанция положительна", () => {
    const f = fit3D([-1, -1, -1], [1, 1, 1], 50);
    expect(f.center).toEqual([0, 0, 0]);
    expect(f.distance).toBeGreaterThan(0);
  });
  it("вырожденные bounds → дистанция конечна", () => {
    const f = fit3D([0, 0, 0], [0, 0, 0], 50);
    expect(Number.isFinite(f.distance)).toBe(true);
    expect(f.distance).toBeGreaterThan(0);
  });
});
