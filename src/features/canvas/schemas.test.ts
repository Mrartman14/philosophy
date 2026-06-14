// src/features/canvas/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  CanvasDataSchema,
  CanvasCreateSchema,
  CanvasUpdateSchema,
  CanvasVisibilitySchema,
  CanvasIdSchema,
  parseCanvasDataJson,
} from "./schemas";

// Валидный UUIDv4 (variant nibble [89ab]) — zod v4 .uuid() строже v3, требует
// корректную версию/вариант. Совпадает с тестовыми UUID других слайсов.
const UUID = "550e8400-e29b-41d4-a716-446655440000";

const VALID_NODE_TEXT = { id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40, text: "hi" };
const VALID_NODE_SHAPE = { id: "n2", type: "shape", x: 10, y: 10, width: 80, height: 80, shape_kind: "rect" };
const VALID_NODE_REF = { id: "n3", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entity_type: "document", entity_id: UUID };

describe("CanvasDataSchema — success", () => {
  it("принимает пустой граф", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [], edges: [] }).success).toBe(true);
  });
  it("принимает text/shape/entity_ref узлы", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT, VALID_NODE_SHAPE, VALID_NODE_REF], edges: [] });
    expect(r.success).toBe(true);
  });
  it("принимает ребро между существующими узлами", () => {
    const r = CanvasDataSchema.safeParse({
      nodes: [VALID_NODE_TEXT, VALID_NODE_SHAPE],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2", style: "dashed", end: "arrow", from_side: "right", to_side: "left", label: "x" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("CanvasDataSchema — failure", () => {
  it("отклоняет неположительную width", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...VALID_NODE_TEXT, width: 0 }], edges: [] }).success).toBe(false);
  });
  it("отклоняет text-узел без text", () => {
    const { id, type, x, y, width, height } = VALID_NODE_TEXT;
    expect(CanvasDataSchema.safeParse({ nodes: [{ id, type, x, y, width, height }], edges: [] }).success).toBe(false);
  });
  it("отклоняет shape-узел без shape_kind", () => {
    const { text: _text, ...rest } = VALID_NODE_TEXT;
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...rest, type: "shape" }], edges: [] }).success).toBe(false);
  });
  it("отклоняет entity_ref с неразрешённым типом", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...VALID_NODE_REF, entity_type: "user" }], edges: [] }).success).toBe(false);
  });
  it("отклоняет дубликат node.id", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT, { ...VALID_NODE_SHAPE, id: "n1" }], edges: [] }).success).toBe(false);
  });
  it("отклоняет ребро с from_node на несуществующий узел", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT], edges: [{ id: "e1", from_node: "missing", to_node: "n1" }] });
    expect(r.success).toBe(false);
  });
  it("отклоняет ребро с to_node на несуществующий узел", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT], edges: [{ id: "e1", from_node: "n1", to_node: "missing" }] });
    expect(r.success).toBe(false);
  });
  it("отклоняет >2000 узлов", () => {
    const nodes = Array.from({ length: 2001 }, (_, i) => ({ ...VALID_NODE_TEXT, id: `n${i}` }));
    expect(CanvasDataSchema.safeParse({ nodes, edges: [] }).success).toBe(false);
  });
  it("отклоняет node text длиннее 10000", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...VALID_NODE_TEXT, text: "a".repeat(10001) }], edges: [] }).success).toBe(false);
  });
  it("отклоняет edge label длиннее 200", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT], edges: [{ id: "e1", from_node: "n1", to_node: "n1", label: "a".repeat(201) }] });
    expect(r.success).toBe(false);
  });
});

describe("parseCanvasDataJson", () => {
  it("парсит валидный JSON в CanvasData", () => {
    const json = JSON.stringify({ nodes: [VALID_NODE_TEXT], edges: [] });
    const r = parseCanvasDataJson(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nodes).toHaveLength(1);
  });
  it("возвращает ошибку на битый JSON", () => {
    const r = parseCanvasDataJson("{ broken");
    expect(r.ok).toBe(false);
  });
  it("возвращает ошибку на невалидную структуру", () => {
    const r = parseCanvasDataJson(JSON.stringify({ nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 0, height: 10 }], edges: [] }));
    expect(r.ok).toBe(false);
  });
  it("пустую строку трактует как пустой граф", () => {
    const r = parseCanvasDataJson("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ nodes: [], edges: [] });
  });
});

describe("CanvasCreateSchema", () => {
  it("принимает title без visibility/data", () => {
    expect(CanvasCreateSchema.safeParse({ title: "Граф" }).success).toBe(true);
  });
  it("отклоняет пустой title", () => {
    expect(CanvasCreateSchema.safeParse({ title: "" }).success).toBe(false);
  });
  it("парсит data-JSON строку в объект", () => {
    const r = CanvasCreateSchema.safeParse({ title: "Граф", data: JSON.stringify({ nodes: [VALID_NODE_TEXT], edges: [] }) });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data?.nodes).toHaveLength(1);
  });
  it("отклоняет битый data-JSON", () => {
    expect(CanvasCreateSchema.safeParse({ title: "Граф", data: "{bad" }).success).toBe(false);
  });
});

describe("CanvasUpdateSchema", () => {
  it("требует id, title, data", () => {
    const r = CanvasUpdateSchema.safeParse({
      id: UUID,
      title: "Граф",
      data: JSON.stringify({ nodes: [], edges: [] }),
    });
    expect(r.success).toBe(true);
  });
  it("отклоняет невалидный id", () => {
    expect(CanvasUpdateSchema.safeParse({ id: "x", title: "Граф", data: "{}" }).success).toBe(false);
  });
});

describe("CanvasVisibilitySchema / CanvasIdSchema", () => {
  it("visibility принимает public", () => {
    expect(CanvasVisibilitySchema.safeParse({ id: UUID, visibility: "public" }).success).toBe(true);
  });
  it("visibility отклоняет мусор", () => {
    expect(CanvasVisibilitySchema.safeParse({ id: UUID, visibility: "secret" }).success).toBe(false);
  });
  it("IdSchema отклоняет не-uuid", () => {
    expect(CanvasIdSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});
