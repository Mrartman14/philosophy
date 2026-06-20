// src/features/canvas/editor/validate.test.ts
import { describe, it, expect } from "vitest";

import type { CanvasData } from "../types";

import { validateGraph } from "./validate";

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
  it("дубликат node id → error с nodeId + messageKey", () => {
    const data: CanvasData = { nodes: [textNode("n1"), textNode("n1")], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    const dup = r.errors.find((e) => e.messageKey === "duplicateNodeId");
    expect(dup?.nodeId).toBe("n1");
    expect(dup?.params).toEqual({ id: "n1" });
  });
  it("ребро на несуществующий узел → error с edgeId + messageKey", () => {
    const data: CanvasData = { nodes: [textNode("n1")], edges: [{ id: "e1", from_node: "n1", to_node: "ghost" }] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    const edge = r.errors.find((e) => e.messageKey === "edgeToNotFound");
    expect(edge?.edgeId).toBe("e1");
    expect(edge?.params).toEqual({ id: "e1" });
  });
  it("text-узел без text → error с nodeId + messageKey", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40 }], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.nodeId === "n1" && e.messageKey === "textNodeNoText")).toBe(true);
  });
  it("shape без shape_kind → error (messageKey)", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "shape", x: 0, y: 0, width: 80, height: 80 }], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.messageKey === "shapeNoKind")).toBe(true);
  });
  it("entity_ref без entity_id → error (messageKey)", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entity_type: "document" }], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.messageKey === "entityRefNoId")).toBe(true);
  });
  it("неположительная width → error (messageKey)", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 0, height: 40, text: "x" }], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.messageKey === "nodeSizePositive")).toBe(true);
  });
  it(">2000 узлов → error (messageKey + params)", () => {
    const nodes = Array.from({ length: 2001 }, (_, i) => textNode(`n${i}`));
    const r = validateGraph({ nodes, edges: [] });
    expect(r.ok).toBe(false);
    const tooMany = r.errors.find((e) => e.messageKey === "tooManyNodes");
    expect(tooMany?.params).toEqual({ count: 2001, max: 2000 });
  });
  it("node text > 10000 → error (messageKey)", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40, text: "a".repeat(10001) }], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.messageKey === "nodeTextTooLong")).toBe(true);
  });
  it("edge label > 200 → error (messageKey)", () => {
    const data: CanvasData = { nodes: [textNode("n1")], edges: [{ id: "e1", from_node: "n1", to_node: "n1", label: "a".repeat(201) }] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.messageKey === "edgeLabelTooLong")).toBe(true);
  });
});
