// src/features/annotations/anchor.test.ts
import { describe, it, expect } from "vitest";
import {
  buildTextAnchor,
  buildMediaAnchor,
  isValidTextAnchor,
  isValidMediaAnchor,
} from "./anchor";

describe("buildTextAnchor", () => {
  it("строит text-range якорь с обязательными полями", () => {
    const a = buildTextAnchor({
      startBlockId: "b1",
      endBlockId: "b2",
      startChar: 0,
      endChar: 5,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
    expect(a).toEqual({
      start_block_id: "b1",
      end_block_id: "b2",
      start_char: 0,
      end_char: 5,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("опускает пустые prefix/suffix", () => {
    const a = buildTextAnchor({
      startBlockId: "b1",
      endBlockId: "b1",
      startChar: 0,
      endChar: 3,
      exact: "abc",
    });
    expect(a.prefix).toBeUndefined();
    expect(a.suffix).toBeUndefined();
    expect(a.start_block_id).toBe("b1");
  });
});

describe("isValidTextAnchor", () => {
  it("валиден: оба block_id + exact заданы", () =>
    { expect(
      isValidTextAnchor({
        start_block_id: "b1",
        end_block_id: "b2",
        exact: "x",
      }),
    ).toBe(true); });
  it("невалиден: нет exact", () =>
    { expect(
      isValidTextAnchor({ start_block_id: "b1", end_block_id: "b2" }),
    ).toBe(false); });
  it("невалиден: нет end_block_id", () =>
    { expect(isValidTextAnchor({ start_block_id: "b1", exact: "x" })).toBe(
      false,
    ); });
  it("невалиден: примешаны media-поля", () =>
    { expect(
      isValidTextAnchor({
        start_block_id: "b1",
        end_block_id: "b2",
        exact: "x",
        start_sec: 5,
      }),
    ).toBe(false); });
});

describe("buildMediaAnchor", () => {
  it("строит media-interval с start+end", () => {
    expect(buildMediaAnchor(10, 20)).toEqual({ start_sec: 10, end_sec: 20 });
  });
  it("строит точечный media-якорь без end", () => {
    expect(buildMediaAnchor(10)).toEqual({ start_sec: 10 });
  });
});

describe("isValidMediaAnchor", () => {
  it("валиден: start_sec >= 0", () =>
    { expect(isValidMediaAnchor({ start_sec: 0 })).toBe(true); });
  it("валиден: end_sec > start_sec", () =>
    { expect(isValidMediaAnchor({ start_sec: 5, end_sec: 10 })).toBe(true); });
  it("невалиден: end_sec <= start_sec", () =>
    { expect(isValidMediaAnchor({ start_sec: 10, end_sec: 10 })).toBe(false); });
  it("невалиден: отрицательный start_sec", () =>
    { expect(isValidMediaAnchor({ start_sec: -1 })).toBe(false); });
  it("невалиден: примешаны text-поля", () =>
    { expect(
      isValidMediaAnchor({ start_sec: 5, start_block_id: "b1" }),
    ).toBe(false); });
});
