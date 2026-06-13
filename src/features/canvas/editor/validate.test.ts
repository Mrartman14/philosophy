// src/features/canvas/editor/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateGraph } from "./validate";
import type { CanvasData } from "../types";

const textNode = (id: string): NonNullable<CanvasData["nodes"]>[number] => ({ id, type: "text", x: 0, y: 0, width: 100, height: 40, text: "hi" });

describe("validateGraph — success", () => {
  it("пустой граф ок", () => {
    expect(validateGraph({ nodes: [], edges: [] }).ok).toBe(true);
  });
  it("валидные узлы + ребро ок", () => {
    const data: CanvasData = {
      nodes: [textNode("n1"), { id: "n2", type: "shape", x: 10, y: 10, width: 80, height: 80, shape_kind: "rect" }],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2" }],
    };
    expect(validateGraph(data).ok).toBe(true);
  });
});

describe("validateGraph — failure с привязкой к id", () => {
  it("дубликат node id → error с nodeId", () => {
    const data: CanvasData = { nodes: [textNode("n1"), textNode("n1")], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.nodeId === "n1")).toBe(true);
  });
  it("ребро на несуществующий узел → error с edgeId", () => {
    const data: CanvasData = { nodes: [textNode("n1")], edges: [{ id: "e1", from_node: "n1", to_node: "ghost" }] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.edgeId === "e1")).toBe(true);
  });
  it("text-узел без text → error с nodeId", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40 }], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.nodeId === "n1")).toBe(true);
  });
  it("shape без shape_kind → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "shape", x: 0, y: 0, width: 80, height: 80 }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it("entity_ref без entity_id → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entity_type: "document" }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it("неположительная width → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 0, height: 40, text: "x" }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it(">2000 узлов → error", () => {
    const nodes = Array.from({ length: 2001 }, (_, i) => textNode(`n${i}`));
    expect(validateGraph({ nodes, edges: [] }).ok).toBe(false);
  });
  it("node text > 10000 → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40, text: "a".repeat(10001) }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it("edge label > 200 → error", () => {
    const data: CanvasData = { nodes: [textNode("n1")], edges: [{ id: "e1", from_node: "n1", to_node: "n1", label: "a".repeat(201) }] };
    expect(validateGraph(data).ok).toBe(false);
  });
});
