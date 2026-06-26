// src/features/canvas/editor/canvas-reducer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CanvasData } from "../types";

import { canvasReducer, initEditorState } from "./canvas-reducer";
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

describe("tool команды", () => {
  it("setTool переключает инструмент, не трогая data/undo", () => {
    const s = initEditorState({ nodes: [], edges: [] });
    expect(s.tool).toBe("select");
    const next = canvasReducer(s, { type: "setTool", tool: "hand" });
    expect(next.tool).toBe("hand");
    expect(next.past).toHaveLength(0);
    expect(next.data).toBe(s.data);
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
    // снап всегда включён → x снапится к сетке 8px: snap(50)=48.
    expect(added?.x).toBe(48);
    expect(s.dirty).toBe(true);
    expect(s.past).toHaveLength(1);
    expect(s.selection.nodeIds).toEqual(["gen-1"]);
  });
  it("addTextNode принимает явный id (для авто-редактирования только что созданного узла)", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0, id: "fixed-1" });
    expect(s.data.nodes?.[2]?.id).toBe("fixed-1");
    expect(s.selection.nodeIds).toEqual(["fixed-1"]);
  });
  it("addTextNode без id генерирует id через newId", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    expect(s.data.nodes?.[2]?.id).toBe("gen-1");
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

describe("move / resize", () => {
  it("moveSelection сдвигает выбранные узлы и делает dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    s = canvasReducer(s, { type: "moveSelection", dx: 10, dy: 20 });
    expect(s.data.nodes?.[0]?.x).toBe(10);
    expect(s.data.nodes?.[0]?.y).toBe(20);
    expect(s.data.nodes?.[1]?.x).toBe(200); // n2 не выбран — не двигается
    expect(s.dirty).toBe(true);
  });
  it("moveSelection без выделения — no-op", () => {
    const s0 = initEditorState(baseData);
    const s1 = canvasReducer(s0, { type: "moveSelection", dx: 10, dy: 10 });
    expect(s1).toBe(s0);
  });
  it("resizeNode se увеличивает размер", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "resizeNode", nodeId: "n2", handle: "se", dx: 20, dy: 10 });
    expect(s.data.nodes?.[1]?.width).toBe(100);
    expect(s.data.nodes?.[1]?.height).toBe(90);
  });
  it("setNodeSize клампит минимум 20", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "setNodeSize", nodeId: "n1", width: 5, height: 5 });
    expect(s.data.nodes?.[0]?.width).toBe(20);
    expect(s.data.nodes?.[0]?.height).toBe(20);
  });
});

describe("z-order (bringToFront / sendToBack)", () => {
  function fourNodeState() {
    const data = {
      nodes: [
        { id: "a", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
        { id: "b", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
        { id: "c", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
        { id: "d", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
      ],
      edges: [],
    } as unknown as Parameters<typeof initEditorState>[0];
    return initEditorState(data);
  }
  const ids = (s: ReturnType<typeof initEditorState>) => (s.data.nodes ?? []).map((n) => n.id);

  it("bringToFront перемещает выбранные в конец, сохраняя их относительный порядок", () => {
    const s = fourNodeState();
    const next = canvasReducer(s, { type: "bringToFront", nodeIds: ["b", "a"] });
    // a,b уходят в конец в их ИСХОДНОМ относительном порядке (a перед b)
    expect(ids(next)).toEqual(["c", "d", "a", "b"]);
    expect(next.past).toHaveLength(1); // undoable
    expect(next.dirty).toBe(true);
  });

  it("sendToBack перемещает выбранные в начало, сохраняя относительный порядок", () => {
    const s = fourNodeState();
    const next = canvasReducer(s, { type: "sendToBack", nodeIds: ["d", "c"] });
    expect(ids(next)).toEqual(["c", "d", "a", "b"]);
  });

  it("bringToFront — no-op на пустом наборе и несуществующих id", () => {
    const s = fourNodeState();
    expect(canvasReducer(s, { type: "bringToFront", nodeIds: [] })).toBe(s);
    expect(canvasReducer(s, { type: "bringToFront", nodeIds: ["zzz"] })).toBe(s);
  });
});

describe("edit node", () => {
  it("setNodeText меняет текст text-узла", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "setNodeText", nodeId: "n1", text: "новый" });
    expect(s.data.nodes?.[0]?.text).toBe("новый");
  });
  it("setShapeKind меняет фигуру", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "setShapeKind", nodeId: "n2", shapeKind: "diamond" });
    expect(s.data.nodes?.[1]?.shape_kind).toBe("diamond");
  });
});

describe("edges", () => {
  it("addEdge создаёт ребро между разными узлами", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addEdge", fromNode: "n1", toNode: "n2", fromSide: "right", toSide: "left" });
    expect(s.data.edges).toHaveLength(1);
    expect(s.data.edges?.[0]).toMatchObject({ id: "gen-1", from_node: "n1", to_node: "n2", from_side: "right", to_side: "left" });
    expect(s.selection.edgeIds).toEqual(["gen-1"]);
  });
  it("addEdge self-loop — no-op", () => {
    const s0 = initEditorState(baseData);
    const s1 = canvasReducer(s0, { type: "addEdge", fromNode: "n1", toNode: "n1" });
    expect(s1).toBe(s0);
  });
  it("setEdgeLabel / setEdgeStyle / setEdgeEnd", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addEdge", fromNode: "n1", toNode: "n2" });
    const firstEdge = s.data.edges?.[0];
    if (firstEdge === undefined) throw new Error("edges пустой после addEdge");
    const eid = firstEdge.id;
    s = canvasReducer(s, { type: "setEdgeLabel", edgeId: eid, label: "связь" });
    s = canvasReducer(s, { type: "setEdgeStyle", edgeId: eid, style: "dashed" });
    s = canvasReducer(s, { type: "setEdgeEnd", edgeId: eid, end: "none" });
    expect(s.data.edges?.[0]).toMatchObject({ label: "связь", style: "dashed", end: "none" });
  });
});

describe("delete", () => {
  it("deleteSelection удаляет узел и инцидентные рёбра", () => {
    let s = initEditorState({
      nodes: baseData.nodes ?? [],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2" }],
    });
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    s = canvasReducer(s, { type: "deleteSelection" });
    expect((s.data.nodes ?? []).map((n) => n.id)).toEqual(["n2"]);
    expect(s.data.edges).toHaveLength(0); // e1 инцидентно n1 → удалено
  });
  it("deleteSelection удаляет выбранное ребро, оставляя узлы", () => {
    let s = initEditorState({
      nodes: baseData.nodes ?? [],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2" }],
    });
    s = canvasReducer(s, { type: "selectEdge", edgeId: "e1", additive: false });
    s = canvasReducer(s, { type: "deleteSelection" });
    expect(s.data.nodes).toHaveLength(2);
    expect(s.data.edges).toHaveLength(0);
  });
});

describe("undo / redo / dirty", () => {
  it("undo откатывает последнюю мутацию", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    expect(s.data.nodes).toHaveLength(3);
    s = canvasReducer(s, { type: "undo" });
    expect(s.data.nodes).toHaveLength(2);
    expect(s.dirty).toBe(false); // вернулись к baseline
  });
  it("redo возвращает откат", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    s = canvasReducer(s, { type: "undo" });
    s = canvasReducer(s, { type: "redo" });
    expect(s.data.nodes).toHaveLength(3);
    expect(s.dirty).toBe(true);
  });
  it("новая мутация чистит future", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    s = canvasReducer(s, { type: "undo" });
    s = canvasReducer(s, { type: "addShapeNode", shapeKind: "rect", x: 0, y: 0 });
    expect(s.future).toHaveLength(0);
    s = canvasReducer(s, { type: "redo" });
    expect(s.data.nodes).toHaveLength(3); // redo no-op (future пуст)
  });
  it("undo на пустом стеке — no-op", () => {
    const s0 = initEditorState(baseData);
    expect(canvasReducer(s0, { type: "undo" })).toBe(s0);
  });
  it("markSaved обновляет baseline и сбрасывает dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    expect(s.dirty).toBe(true);
    s = canvasReducer(s, { type: "markSaved", data: s.data });
    expect(s.dirty).toBe(false);
    // дальнейший undo вернёт к графу с 2 узлами, который теперь != baseline → dirty
    s = canvasReducer(s, { type: "undo" });
    expect(s.dirty).toBe(true);
  });
});

describe("reset", () => {
  it("восстанавливает data из baseline и сбрасывает dirty и выделение", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    s = canvasReducer(s, { type: "moveSelection", dx: 10, dy: 10 });
    expect(s.dirty).toBe(true);
    s = canvasReducer(s, { type: "reset" });
    expect(s.data).toEqual(baseData);
    expect(s.dirty).toBe(false);
    expect(s.selection).toEqual({ nodeIds: [], edgeIds: [] });
  });

  it("undoable: текущий граф уходит в past, undo возвращает изменения", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    const dirtyData = s.data;
    s = canvasReducer(s, { type: "reset" });
    expect(s.data.nodes).toHaveLength(2);
    s = canvasReducer(s, { type: "undo" });
    expect(s.data).toEqual(dirtyData);
    expect(s.dirty).toBe(true);
  });

  it("на чистом графе (нет изменений) — no-op", () => {
    const s0 = initEditorState(baseData);
    expect(canvasReducer(s0, { type: "reset" })).toBe(s0);
  });

  it("откатывает к baseline после markSaved (последнему сохранённому), не к исходному", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    s = canvasReducer(s, { type: "markSaved", data: s.data });
    const savedData = s.data;
    s = canvasReducer(s, { type: "addShapeNode", shapeKind: "rect", x: 0, y: 0 });
    expect(s.dirty).toBe(true);
    s = canvasReducer(s, { type: "reset" });
    expect(s.data).toEqual(savedData);
    expect(s.dirty).toBe(false);
  });
});
