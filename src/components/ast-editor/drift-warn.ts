"use client";
import { useEffect } from "react";

import type { SchemaSnapshot } from "./types";

/**
 * Hardcoded set of node/mark names that the editor currently registers
 * (mirrors buildExtensions in extensions/index.ts and marks/* — Phase 1).
 * Update both lists when adding/removing extensions.
 */
const HARDCODE_NODES = new Set([
  "paragraph", "heading", "blockquote", "code_block", "list", "list_item",
  "image", "table", "table_row", "table_cell", "thematic_break", "hard_break",
  "text",
]);

const HARDCODE_MARKS = new Set([
  "bold", "italic", "code", "link",
  "lecture_ref", "glossary_ref", "document_ref",
  "media_ref", "canvas_ref", "comment_ref",
]);

const seen = new WeakSet<SchemaSnapshot>();

export function useDriftWarn(schema: SchemaSnapshot) {
  useEffect(() => {
    // Next.js inline-replace работает только для точечного доступа
    // (process.env.NODE_ENV), bracket-notation в браузерном бандле даст
    // ReferenceError. Не менять на process.env["NODE_ENV"].
    if (process.env.NODE_ENV === "production") return;
    if (seen.has(schema)) return;
    seen.add(schema);

    const runtimeNodes = new Set(schema.nodes.keys());
    const runtimeMarks = new Set(schema.marks.keys());

    const diffSet = (a: Set<string>, b: Set<string>) =>
      [...a].filter((x) => !b.has(x));

    const newNodes = diffSet(runtimeNodes, HARDCODE_NODES);
    const droppedNodes = diffSet(HARDCODE_NODES, runtimeNodes);
    const newMarks = diffSet(runtimeMarks, HARDCODE_MARKS);
    const droppedMarks = diffSet(HARDCODE_MARKS, runtimeMarks);

    if (newNodes.length || droppedNodes.length || newMarks.length || droppedMarks.length) {
      console.warn(
        "[ast-editor] schema drift detected — regenerate src/api/schema.ts and update extensions:",
        { newNodes, droppedNodes, newMarks, droppedMarks },
      );
    }
  }, [schema]);
}
