// Логика трёх взаимоисключающих режимов списка (bullet/ordered/task) для тулбара.
// Чинит баг активного состояния (чек-лист подсвечивал и кнопку буллета, т.к. оба
// ordered:false) и даёт переключение режимов без выхода из списка.
import { Editor } from "@tiptap/core";
import { describe, it, expect, afterEach } from "vitest";

import { buildExtensions } from "../../extensions";
import type { SchemaSnapshot } from "../../types";

import { listActiveState, applyListKind } from "./list-actions";

const fullSnapshot: SchemaSnapshot = {
  blockLevels: {
    full: ["paragraph", "heading", "blockquote", "code_block", "list", "image", "table", "thematic_break"],
  },
  entityBlockLimits: { full: 20000 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

interface PMJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMJson[];
  text?: string;
}

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function makeEditor(content: PMJson): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: buildExtensions({ snapshot: fullSnapshot, context: "document" }),
    content,
  });
  editor.commands.focus("end");
  return editor;
}

const paragraphDoc: PMJson = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "текст" }] }],
};

function listDoc(ordered: boolean, checked?: boolean): PMJson {
  return {
    type: "doc",
    content: [
      {
        type: "list",
        attrs: { ordered },
        content: [
          {
            type: "list_item",
            ...(checked === undefined ? {} : { attrs: { checked } }),
            content: [{ type: "paragraph", content: [{ type: "text", text: "пункт" }] }],
          },
        ],
      },
    ],
  };
}

function firstItem(ed: Editor): PMJson | undefined {
  const doc = ed.getJSON() as PMJson;
  return doc.content?.[0]?.content?.[0];
}

function topLevel(ed: Editor): PMJson[] {
  return (ed.getJSON() as PMJson).content ?? [];
}

describe("listActiveState — различение режимов", () => {
  it("в маркированном списке активен ТОЛЬКО bullet", () => {
    const ed = makeEditor(listDoc(false));
    expect(listActiveState(ed)).toEqual({ bullet: true, ordered: false, task: false });
  });

  it("в нумерованном — ТОЛЬКО ordered", () => {
    const ed = makeEditor(listDoc(true));
    expect(listActiveState(ed)).toEqual({ bullet: false, ordered: true, task: false });
  });

  it("в чек-листе активен ТОЛЬКО task (НЕ bullet — это и есть фикс бага)", () => {
    const ed = makeEditor(listDoc(false, false));
    expect(listActiveState(ed)).toEqual({ bullet: false, ordered: false, task: true });
  });

  it("вне списка — всё false", () => {
    const ed = makeEditor(paragraphDoc);
    expect(listActiveState(ed)).toEqual({ bullet: false, ordered: false, task: false });
  });
});

describe("applyListKind — конверсия режимов", () => {
  it("параграф → bullet: оборачивает в список, checked=null", () => {
    const ed = makeEditor(paragraphDoc);
    applyListKind(ed, "bullet");
    expect(listActiveState(ed).bullet).toBe(true);
    expect(firstItem(ed)?.attrs?.checked ?? null).toBeNull();
  });

  it("параграф → task: список с checked=false", () => {
    const ed = makeEditor(paragraphDoc);
    applyListKind(ed, "task");
    expect(listActiveState(ed).task).toBe(true);
    expect(firstItem(ed)?.attrs?.checked).toBe(false);
  });

  it("bullet → task: проставляет checked=false (без выхода из списка)", () => {
    const ed = makeEditor(listDoc(false));
    applyListKind(ed, "task");
    expect(listActiveState(ed).task).toBe(true);
    expect(firstItem(ed)?.attrs?.checked).toBe(false);
  });

  it("task → bullet: снимает checked (null)", () => {
    const ed = makeEditor(listDoc(false, false));
    applyListKind(ed, "bullet");
    expect(listActiveState(ed).bullet).toBe(true);
    expect(firstItem(ed)?.attrs?.checked ?? null).toBeNull();
  });

  it("ordered → task: меняет ordered→false и checked→false", () => {
    const ed = makeEditor(listDoc(true));
    applyListKind(ed, "task");
    expect(listActiveState(ed).task).toBe(true);
    expect(firstItem(ed)?.attrs?.checked).toBe(false);
  });

  it("повторный клик по активному режиму выходит из списка (toggle off)", () => {
    const ed = makeEditor(listDoc(false));
    applyListKind(ed, "bullet");
    expect(listActiveState(ed).bullet).toBe(false);
    expect(topLevel(ed).some((n) => n.type === "paragraph")).toBe(true);
  });

  it("повторный клик по task выходит из списка", () => {
    const ed = makeEditor(listDoc(false, false));
    applyListKind(ed, "task");
    expect(listActiveState(ed).task).toBe(false);
    expect(topLevel(ed).some((n) => n.type === "paragraph")).toBe(true);
  });
});
