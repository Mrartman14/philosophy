import { describe, it, expect } from "vitest";

import { clusterColor } from "./cluster-color";

describe("clusterColor", () => {
  it("отдаёт явный валидный hex как есть", () => {
    expect(clusterColor(0, "#AABBCC")).toBe("#AABBCC");
  });
  it("игнорит невалидный explicit и берёт палитру по id", () => {
    expect(clusterColor(0, "red")).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(clusterColor(0, null)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it("детерминирован по id и зацикливает палитру", () => {
    expect(clusterColor(3)).toBe(clusterColor(3));
    expect(clusterColor(0)).toBe(clusterColor(10)); // палитра из 10 цветов
  });
  it("корректен для отрицательного id", () => {
    expect(clusterColor(-1)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
