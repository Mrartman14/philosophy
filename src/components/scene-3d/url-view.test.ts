import { describe, it, expect, vi, afterEach } from "vitest";

import { parseView, formatView, writeViewToUrl } from "./url-view";

describe("parseView", () => {
  it("валидный 2D: m+c (3 числа)", () => {
    const r = parseView({ m: "2d", c: "1.5,-2,3" });
    expect(r.mode).toBe("2d");
    expect(r.camera).toEqual({ mode: "2d", values: [1.5, -2, 3] });
  });
  it("валидный 3D: m+c (6 чисел)", () => {
    const r = parseView({ m: "3d", c: "1,2,3,4,5,6" });
    expect(r.mode).toBe("3d");
    expect(r.camera).toEqual({ mode: "3d", values: [1, 2, 3, 4, 5, 6] });
  });
  it("m-only: режим есть, камера null", () => {
    expect(parseView({ m: "3d" })).toEqual({ mode: "3d", camera: null });
  });
  it("битый режим → mode null, camera null", () => {
    expect(parseView({ m: "4d", c: "1,2,3" })).toEqual({ mode: null, camera: null });
  });
  it("c без m → camera null", () => {
    expect(parseView({ c: "1,2,3" })).toEqual({ mode: null, camera: null });
  });
  it("неверная длина c → camera null, mode сохранён", () => {
    expect(parseView({ m: "2d", c: "1,2" })).toEqual({ mode: "2d", camera: null });
  });
  it("NaN/не-finite → camera null", () => {
    expect(parseView({ m: "2d", c: "1,x,3" }).camera).toBeNull();
    expect(parseView({ m: "3d", c: "1,2,3,4,5,Infinity" }).camera).toBeNull();
  });
  it("2D zoom <= 0 → camera null (защита от деления на ноль)", () => {
    expect(parseView({ m: "2d", c: "1,2,0" }).camera).toBeNull();
    expect(parseView({ m: "2d", c: "1,2,-1" }).camera).toBeNull();
  });
});

describe("formatView", () => {
  it("2D: координаты до 4 знаков, zoom до 3", () => {
    expect(formatView({ mode: "2d", values: [1.123456, -2.987654, 3.14159] }))
      .toEqual({ m: "2d", c: "1.1235,-2.9877,3.142" });
  });
  it("3D: все 6 значений до 4 знаков", () => {
    expect(formatView({ mode: "3d", values: [1.111111, 2, 3, 4, 5, 6] }).c)
      .toBe("1.1111,2,3,4,5,6");
  });
  it("нормализует -0 → 0", () => {
    expect(formatView({ mode: "2d", values: [-0.00001, 0, 1] }).c).toBe("0,0,1");
  });
});

describe("round-trip format→parse (с допуском под округление)", () => {
  it("3D round-trip", () => {
    const src = { mode: "3d" as const, values: [1.23456, 0.4, 2.1, 0.1, 0, -0.5] };
    const { m, c } = formatView(src);
    const back = parseView({ m, c }).camera;
    expect(back).not.toBeNull();
    back?.values.forEach((v, i) => {
      expect(v).toBeCloseTo(src.values[i] ?? Number.NaN, 4);
    });
  });
});

describe("writeViewToUrl", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("мёржит m/c, сохраняя q и hash", () => {
    window.history.replaceState({}, "", "/map?q=foo#sec");
    const spy = vi.spyOn(window.history, "replaceState");
    writeViewToUrl({ mode: "2d", values: [1, 2, 3] });
    const firstCall = spy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const url = String(firstCall?.[2]);
    expect(url).toContain("q=foo");
    expect(url).toContain("m=2d");
    expect(url).toContain("c=1%2C2%2C3"); // запятые URL-кодируются
    expect(url).toContain("#sec");
  });
});
