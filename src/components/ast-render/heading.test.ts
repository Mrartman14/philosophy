// src/components/ast-render/heading.test.ts
import { describe, it, expect } from "vitest";

import { readHeadingLevel } from "./heading";

describe("readHeadingLevel", () => {
  it("возвращает число 1–6 как есть", () => {
    expect(readHeadingLevel({ level: 1 })).toBe(1);
    expect(readHeadingLevel({ level: 6 })).toBe(6);
  });
  it("дефолт 2 при отсутствии level", () => {
    expect(readHeadingLevel(undefined)).toBe(2);
    expect(readHeadingLevel({})).toBe(2);
  });
  it("дефолт 2 при выходе за диапазон", () => {
    expect(readHeadingLevel({ level: 0 })).toBe(2);
    expect(readHeadingLevel({ level: 7 })).toBe(2);
  });
  it("дефолт 2 при нечисловом level", () => {
    expect(readHeadingLevel({ level: "3" as unknown as number })).toBe(2);
  });
});
