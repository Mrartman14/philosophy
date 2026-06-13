// src/features/canvas/editor/canvas-reducer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { canvasReducer, initEditorState } from "./canvas-reducer";
import type { CanvasData } from "../types";
import * as idMod from "./id";

const baseData: CanvasData = {
  nodes: [
    { id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40, text: "a" },
    { id: "n2", type: "shape", x: 200, y: 0, width: 80, height: 80, shape_kind: "rect" },
  ],
  edges: [],
};

let idCounter = 0;
beforeEach(() => {
  idCounter = 0;
  vi.spyOn(idMod, "newId").mockImplementation(() => `gen-${++idCounter}`);
});

describe("initEditorState", () => {
  it("кладёт data, пустое выделение, чистые стеки, dirty=false", () => {
    const s = initEditorState(baseData);
    expect(s.data).toEqual(baseData);
    expect(s.selection).toEqual({ nodeIds: [], edgeIds: [] });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.dirty).toBe(false);
    expect(s.baseline).toEqual(baseData);
    expect(s.gridEnabled).toBe(true);
    expect(s.viewport.zoom).toBe(1);
  });
  it("нормализует undefined nodes/edges в пустые массивы", () => {
    const s = initEditorState({});
    expect(s.data.nodes).toEqual([]);
    expect(s.data.edges).toEqual([]);
  });
});

describe("selection команды", () => {
  it("selectNode (не additive) заменяет выделение", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    expect(s.selection.nodeIds).toEqual(["n1"]);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n2", additive: false });
    expect(s.selection.nodeIds).toEqual(["n2"]);
  });
  it("selectNode additive добавляет и тогглит", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: true });
    s = canvasReducer(s, { type: "selectNode", nodeId: "n2", additive: true });
    expect(s.selection.nodeIds.sort()).toEqual(["n1", "n2"]);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: true });
    expect(s.selection.nodeIds).toEqual(["n2"]);
  });
  it("clearSelection очищает", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectMany", nodeIds: ["n1", "n2"], edgeIds: [] });
    s = canvasReducer(s, { type: "clearSelection" });
    expect(s.selection).toEqual({ nodeIds: [], edgeIds: [] });
  });
  it("selection не делает граф dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    expect(s.dirty).toBe(false);
    expect(s.past).toHaveLength(0);
  });
});

describe("viewport команды", () => {
  it("panBy сдвигает мир", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "panBy", dx: 10, dy: -5 });
    expect(s.viewport.x).toBe(10);
    expect(s.viewport.y).toBe(-5);
  });
  it("toggleGrid переключает", () => {
    let s = initEditorState(baseData);
    expect(s.gridEnabled).toBe(true);
    s = canvasReducer(s, { type: "toggleGrid" });
    expect(s.gridEnabled).toBe(false);
  });
});

describe("add-команды", () => {
  it("addTextNode добавляет text-узел с новым id и делает dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 50, y: 60 });
    expect(s.data.nodes).toHaveLength(3);
    const added = s.data.nodes?.[2];
    expect(added?.id).toBe("gen-1");
    expect(added?.type).toBe("text");
    expect(added?.text).toBe("");
    // gridEnabled=true по умолчанию → x снапится к сетке 8px: snap(50)=48.
    expect(added?.x).toBe(48);
    expect(s.dirty).toBe(true);
    expect(s.past).toHaveLength(1);
    expect(s.selection.nodeIds).toEqual(["gen-1"]);
  });
  it("addShapeNode задаёт shape_kind", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addShapeNode", shapeKind: "ellipse", x: 0, y: 0 });
    expect(s.data.nodes?.[2]?.type).toBe("shape");
    expect(s.data.nodes?.[2]?.shape_kind).toBe("ellipse");
  });
  it("addEntityRefNode задаёт entity_type/entity_id без anchor", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addEntityRefNode", entityType: "document", entityId: "d1", x: 0, y: 0 });
    const n = s.data.nodes?.[2];
    expect(n?.type).toBe("entity_ref");
    expect(n?.entity_type).toBe("document");
    expect(n?.entity_id).toBe("d1");
    expect(n?.anchor).toBeUndefined();
  });
});
