import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { Editor } from "@tiptap/core";
import { render, screen, cleanup } from "@testing-library/react";
import { EditorToolbar } from "./toolbar";
import { buildExtensions } from "../extensions";
import type { EntityContext, SchemaSnapshot } from "../types";

afterEach(cleanup);

const fullSchema: SchemaSnapshot = {
  blockLevels: {
    full: ["paragraph", "heading", "blockquote", "code_block", "list", "image", "table", "thematic_break"],
    basic: ["paragraph"],
  },
  entityBlockLimits: { full: 20000, basic: 100 },
  entityContexts: { document: "full", comment: "basic" },
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map([["bold", { attrs: {} }], ["italic", { attrs: {} }], ["code", { attrs: {} }], ["link", { attrs: {} }]]),
  exclusiveCategories: [],
};

const makeEditor = (context: EntityContext) =>
  new Editor({ extensions: buildExtensions({ snapshot: fullSchema, context }) });

describe("EditorToolbar gating", () => {
  it("document context: shows heading select, blockquote, code-block, list, table, hr", () => {
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="document" />);
    expect(screen.getByLabelText(/тип блока/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/цитата/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/блок кода/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/маркированный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/нумерованный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/таблица/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/горизонтальная линия/i)).toBeInTheDocument();
    editor.destroy();
  });

  it("shows RefPopover when nav-ref marks are registered", () => {
    const navSchema: SchemaSnapshot = {
      ...fullSchema,
      marks: new Map([
        ["bold", { attrs: {} }],
        ["link", { attrs: {} }],
        ["lecture_ref", { attrs: {} }],
      ]),
    };
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={navSchema} context="document" />);
    expect(screen.getByLabelText(/вставить ссылку на сущность/i)).toBeInTheDocument();
    editor.destroy();
  });

  it("hides RefPopover when nav-ref marks are not registered", () => {
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="document" />);
    expect(screen.queryByLabelText(/вставить ссылку на сущность/i)).toBeNull();
    editor.destroy();
  });

  it("comment context (basic): hides everything except inline marks + link", () => {
    const editor = makeEditor("comment");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="comment" />);
    expect(screen.queryByLabelText(/тип блока/i)).toBeNull();
    expect(screen.queryByLabelText(/цитата/i)).toBeNull();
    expect(screen.queryByLabelText(/блок кода/i)).toBeNull();
    expect(screen.queryByLabelText(/маркированный список/i)).toBeNull();
    expect(screen.queryByLabelText(/таблица/i)).toBeNull();
    // inline marks + link still present (always-allowed)
    expect(screen.getByLabelText(/жирный/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ссылка/i)).toBeInTheDocument();
    editor.destroy();
  });
});
