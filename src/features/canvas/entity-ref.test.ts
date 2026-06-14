// src/features/canvas/entity-ref.test.ts
import { describe, it, expect } from "vitest";

import { resolveEntityRefView } from "./entity-ref";

describe("resolveEntityRefView", () => {
  it("document → ссылка и метка", () => {
    expect(resolveEntityRefView("document", "d1")).toEqual({ href: "/documents/d1", typeLabel: "Документ" });
  });
  it("lecture → /lectures/", () => {
    expect(resolveEntityRefView("lecture", "l1").href).toBe("/lectures/l1");
  });
  it("canvas → /canvases/", () => {
    expect(resolveEntityRefView("canvas", "c1").href).toBe("/canvases/c1");
  });
  it("annotation → нет страницы (href null), метка есть", () => {
    const v = resolveEntityRefView("annotation", "a1");
    expect(v.href).toBeNull();
    expect(v.typeLabel).toBe("Аннотация");
  });
  it("banner/event → href null", () => {
    expect(resolveEntityRefView("banner", "b1").href).toBeNull();
    expect(resolveEntityRefView("event", "e1").href).toBeNull();
  });
  it("неизвестный тип → href null, метка «Объект»", () => {
    const v = resolveEntityRefView("unknown", "x");
    expect(v.href).toBeNull();
    expect(v.typeLabel).toBe("Объект");
  });
  it("экранирует id в href", () => {
    expect(resolveEntityRefView("document", "a b").href).toBe("/documents/a%20b");
  });
});
