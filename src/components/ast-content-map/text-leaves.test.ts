import { describe, it, expect } from "vitest";

import { NODE_MAP, TEXT_LEAF_NODE_TYPES } from "@/components/ast-content-map";
import type { AstNodeType } from "@/components/ast-content-map";

// Ровно те типы, что несут текстовый лист с собственным node_id (sub-block anchor).
// Зафиксировано как контракт round-trip адресуемости: serializer пишет id ↔
// deserializer читает id ↔ read-render навешивает data-node-id. Дрейф любой из
// точек → тихий орфан якоря, поэтому состав закреплён здесь дословно.
const EXPECTED: readonly AstNodeType[] = ["paragraph", "heading", "code_block", "table_cell"];

describe("TEXT_LEAF_NODE_TYPES — единый SOT листовых типов якоря", () => {
  it("содержит ровно 4 типа", () => {
    expect(TEXT_LEAF_NODE_TYPES.size).toBe(4);
  });

  it("состоит ровно из paragraph/heading/code_block/table_cell", () => {
    for (const type of EXPECTED) {
      expect(TEXT_LEAF_NODE_TYPES.has(type)).toBe(true);
    }
    expect([...TEXT_LEAF_NODE_TYPES].sort()).toEqual([...EXPECTED].sort());
  });

  it("каждый член — известный листовой тип карты (ключ NODE_MAP)", () => {
    // Защита от дрейфа: лист без записи в NODE_MAP не отрендерится в read-слое,
    // якорь молча осиротеет. Members ⊆ keys(NODE_MAP).
    for (const type of TEXT_LEAF_NODE_TYPES) {
      expect(NODE_MAP[type]).toBeDefined();
    }
  });
});
