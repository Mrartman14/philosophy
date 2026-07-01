import { describe, expect, it } from "vitest";

import { coordsToEngineAnchor, engineAnchorToCoords } from "./text-anchor";

describe("coordsToEngineAnchor", () => {
  it("маппит полный text-range в TextAnchor движка", () => {
    expect(
      coordsToEngineAnchor({
        start_block_id: "b1",
        end_block_id: "b2",
        start_char: 3,
        end_char: 7,
        exact: "слово",
        prefix: "до ",
        suffix: " после",
      }),
    ).toEqual({
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b2",
      endNodeId: "b2",
      startChar: 3,
      endChar: 7,
      exact: "слово",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("coordsToEngineAnchor: node-id из wire", () => {
    const e = coordsToEngineAnchor({
      start_block_id: "b1",
      end_block_id: "b1",
      start_node_id: "n1",
      end_node_id: "n2",
      start_char: 0,
      end_char: 2,
      exact: "ab",
    });
    expect(e).toMatchObject({ startNodeId: "n1", endNodeId: "n2", startBlockId: "b1", endBlockId: "b1" });
  });

  it("coordsToEngineAnchor: node-id отсутствует → fallback на block-id (legacy/proza)", () => {
    const e = coordsToEngineAnchor({
      start_block_id: "b1",
      end_block_id: "b1",
      start_char: 0,
      end_char: 2,
      exact: "ab",
    });
    expect(e).toMatchObject({ startNodeId: "b1", endNodeId: "b1" });
  });

  it("дефолтит отсутствующие char-поля в 0", () => {
    const r = coordsToEngineAnchor({ start_block_id: "b1", end_block_id: "b1", exact: "x" });
    expect(r).toMatchObject({ startChar: 0, endChar: 0 });
  });

  it("возвращает null для media-якоря", () => {
    expect(coordsToEngineAnchor({ start_sec: 1, end_sec: 2 })).toBeNull();
  });

  it("возвращает null для неполного text-range", () => {
    expect(coordsToEngineAnchor({ start_block_id: "b1", exact: "x" })).toBeNull();
  });
});

describe("engineAnchorToCoords", () => {
  it("маппит обратно и опускает пустые prefix/suffix", () => {
    expect(
      engineAnchorToCoords({
        startBlockId: "b1",
        startNodeId: "b1",
        endBlockId: "b2",
        endNodeId: "b2",
        startChar: 1,
        endChar: 4,
        exact: "abc",
      }),
    ).toEqual({
      start_block_id: "b1",
      start_node_id: "b1",
      end_block_id: "b2",
      end_node_id: "b2",
      start_char: 1,
      end_char: 4,
      exact: "abc",
    });
  });

  it("engineAnchorToCoords: node-id в wire", () => {
    const c = engineAnchorToCoords({
      startBlockId: "b1",
      endBlockId: "b1",
      startNodeId: "n1",
      endNodeId: "n2",
      startChar: 0,
      endChar: 2,
      exact: "ab",
    });
    expect(c).toMatchObject({ start_node_id: "n1", end_node_id: "n2" });
  });
});
