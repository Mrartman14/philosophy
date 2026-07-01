// src/features/annotations/anchor.test.ts
import { describe, it, expect } from "vitest";

import {
  buildTextAnchor,
  buildMediaAnchor,
  isValidTextAnchor,
  isValidMediaAnchor,
  toEngineAnchor,
  fromEngineAnchor,
} from "./anchor";

describe("buildTextAnchor", () => {
  it("строит text-range якорь с обязательными полями", () => {
    const a = buildTextAnchor({
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b2",
      endNodeId: "b2",
      startChar: 0,
      endChar: 5,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
    expect(a).toEqual({
      start_block_id: "b1",
      start_node_id: "b1",
      end_block_id: "b2",
      end_node_id: "b2",
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
      startNodeId: "b1",
      endBlockId: "b1",
      endNodeId: "b1",
      startChar: 0,
      endChar: 3,
      exact: "abc",
    });
    expect(a.prefix).toBeUndefined();
    expect(a.suffix).toBeUndefined();
    expect(a.start_block_id).toBe("b1");
  });

  // Характеризующий тест: node_id наследуется через общий конвертер
  // (engineAnchorToCoords, Task 4) — фиксируем lock-in под-блочной адресации.
  it("buildTextAnchor: пробрасывает node_id", () => {
    const a = buildTextAnchor({ startBlockId: "b1", endBlockId: "b1", startNodeId: "b1", endNodeId: "b1", startChar: 0, endChar: 2, exact: "ab" });
    expect(a).toMatchObject({ start_node_id: "b1", end_node_id: "b1" });
  });
});

describe("isValidTextAnchor", () => {
  it("валиден: оба block_id + оба node_id + exact заданы", () =>
    { expect(
      isValidTextAnchor({
        start_block_id: "b1",
        start_node_id: "b1",
        end_block_id: "b2",
        end_node_id: "b2",
        exact: "x",
      }),
    ).toBe(true); });
  it("невалиден: нет exact", () =>
    { expect(
      isValidTextAnchor({ start_block_id: "b1", start_node_id: "b1", end_block_id: "b2", end_node_id: "b2" }),
    ).toBe(false); });
  it("невалиден: нет node_id (anchors.md правило 1)", () =>
    { expect(
      isValidTextAnchor({ start_block_id: "b1", end_block_id: "b2", exact: "x" }),
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
  it("невалиден: примешан start_node_id (node_id — text-поле, anchors.md)", () =>
    { expect(
      isValidMediaAnchor({ start_sec: 5, start_node_id: "n1" }),
    ).toBe(false); });
  it("невалиден: примешан end_node_id (node_id — text-поле, anchors.md)", () =>
    { expect(
      isValidMediaAnchor({ start_sec: 5, end_node_id: "n1" }),
    ).toBe(false); });
});

describe("toEngineAnchor", () => {
  it("маппит полный text-range Anchor → TextAnchor (camelCase)", () => {
    const engine = toEngineAnchor({
      start_block_id: "b1",
      end_block_id: "b2",
      start_char: 3,
      end_char: 9,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
    expect(engine).toEqual({
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b2",
      endNodeId: "b2",
      startChar: 3,
      endChar: 9,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("дефолтит отсутствующие start_char/end_char в 0", () => {
    const engine = toEngineAnchor({
      start_block_id: "b1",
      end_block_id: "b1",
      exact: "abc",
    });
    expect(engine?.startChar).toBe(0);
    expect(engine?.endChar).toBe(0);
  });

  it("опускает пустые prefix/suffix", () => {
    const engine = toEngineAnchor({
      start_block_id: "b1",
      end_block_id: "b1",
      exact: "abc",
    });
    if (engine === null) throw new Error("expected non-null engine anchor");
    expect("prefix" in engine).toBe(false);
    expect("suffix" in engine).toBe(false);
  });

  it("→ null для media-якоря (start_sec)", () => {
    expect(toEngineAnchor({ start_sec: 10, end_sec: 20 })).toBeNull();
  });

  it("→ null для точечного media-якоря (только start_sec)", () => {
    expect(toEngineAnchor({ start_sec: 10 })).toBeNull();
  });

  it("→ null если примешан end_sec", () => {
    expect(
      toEngineAnchor({
        start_block_id: "b1",
        end_block_id: "b2",
        exact: "x",
        end_sec: 5,
      }),
    ).toBeNull();
  });

  it("→ null при отсутствии start_block_id", () => {
    expect(
      toEngineAnchor({ end_block_id: "b2", exact: "x" }),
    ).toBeNull();
  });

  it("→ null при отсутствии end_block_id", () => {
    expect(
      toEngineAnchor({ start_block_id: "b1", exact: "x" }),
    ).toBeNull();
  });

  it("→ null при отсутствии exact", () => {
    expect(
      toEngineAnchor({ start_block_id: "b1", end_block_id: "b2" }),
    ).toBeNull();
  });

  it("→ null для пустого якоря", () => {
    expect(toEngineAnchor({})).toBeNull();
  });
});

describe("fromEngineAnchor", () => {
  it("маппит TextAnchor → Anchor (snake_case) через buildTextAnchor", () => {
    const anchor = fromEngineAnchor({
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b2",
      endNodeId: "b2",
      startChar: 3,
      endChar: 9,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
    expect(anchor).toEqual({
      start_block_id: "b1",
      start_node_id: "b1",
      end_block_id: "b2",
      end_node_id: "b2",
      start_char: 3,
      end_char: 9,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("опускает пустые prefix/suffix", () => {
    const anchor = fromEngineAnchor({
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b1",
      endNodeId: "b1",
      startChar: 0,
      endChar: 3,
      exact: "abc",
    });
    expect(anchor.prefix).toBeUndefined();
    expect(anchor.suffix).toBeUndefined();
  });
});

describe("round-trip Anchor ↔ TextAnchor", () => {
  it("from(to(a)) сохраняет полный text-range", () => {
    const original = {
      start_block_id: "b1",
      start_node_id: "b1",
      end_block_id: "b2",
      end_node_id: "b2",
      start_char: 3,
      end_char: 9,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    };
    const engine = toEngineAnchor(original);
    if (engine === null) throw new Error("expected non-null engine anchor");
    expect(fromEngineAnchor(engine)).toEqual(original);
  });

  it("from(to(a)) дефолтит char-поля в 0 при их отсутствии", () => {
    const engine = toEngineAnchor({
      start_block_id: "b1",
      end_block_id: "b1",
      exact: "abc",
    });
    if (engine === null) throw new Error("expected non-null engine anchor");
    expect(fromEngineAnchor(engine)).toEqual({
      start_block_id: "b1",
      start_node_id: "b1",
      end_block_id: "b1",
      end_node_id: "b1",
      start_char: 0,
      end_char: 0,
      exact: "abc",
    });
  });
});
