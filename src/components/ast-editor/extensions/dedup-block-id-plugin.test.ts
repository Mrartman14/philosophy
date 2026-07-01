import { getSchema } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { expect, it } from "vitest";

import type { SchemaSnapshot } from "../types";

import { createDedupBlockIdPlugin } from "./dedup-block-id-plugin";

import { buildExtensions } from "./index";

/**
 * Дедуп blockId на ЛЮБОМ узле (не только top-level): id несут и вложенные
 * текстовые листы (table_cell). На split/copy-paste Tiptap клонирует id —
 * плагин обязан очистить все вхождения кроме первого (document-order), чтобы
 * бэк ре-минтил уникальный id на save.
 */

const fullSnapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "heading", "table"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: {
    maxDepth: 32,
    maxTextLen: 1_000_000,
    maxContentItems: 10_000,
    maxMarksPerNode: 100,
  },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const schema = getSchema(buildExtensions({ snapshot: fullSnapshot, context: "document" }));

function blockIds(doc: PMNode): string[] {
  const ids: string[] = [];
  doc.descendants((n) => {
    const id = n.attrs.blockId as unknown;
    if (typeof id === "string" && id !== "") ids.push(id);
  });
  return ids;
}

it("дубль node_id двух ячеек → второй очищается", () => {
  const doc = schema.node("doc", null, [
    schema.node("table", { blockId: "tbl-1" }, [
      schema.node("table_row", null, [
        schema.node("table_cell", { blockId: "dup" }, [schema.text("a")]),
        schema.node("table_cell", { blockId: "dup" }, [schema.text("b")]),
      ]),
    ]),
  ]);
  const state = EditorState.create({ schema, doc, plugins: [createDedupBlockIdPlugin()] });
  // appendTransaction бежит на ЛЮБОЙ применённой транзакции → meta-only достаточно
  // (insertText по позиции 1 невалиден: это граница таблицы, не текст-блок).
  const next = state.apply(state.tr.setMeta("dedup-test", true));
  expect(blockIds(next.doc).filter((id) => id === "dup")).toHaveLength(1);
});
