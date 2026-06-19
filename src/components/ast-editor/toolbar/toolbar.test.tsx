// src/components/ast-editor/toolbar/toolbar.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { describe, it, expect, vi, afterEach } from "vitest";

import { buildExtensions } from "../extensions";
import * as pickerActions from "../pickers/actions";
import type { EntityContext, SchemaSnapshot } from "../types";

import { EditorToolbar } from "./toolbar";

// Фабрики vi.mock не должны ссылаться на внешние переменные (hoisting).
// toolbar.test не ассертит вызовы toast — достаточно inline vi.fn().
vi.mock("@/components/ui", () => ({
  useToast: () => ({ add: vi.fn() }),
}));
// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string, params?: Record<string, string | number>) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (params) {
          return val.replace(/\{(\w+)\}/g, (_: string, k: string) => String(params[k] ?? k));
        }
        return val;
      };
    },
  };
});
vi.mock("../pickers/actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

const mockedActions = pickerActions as unknown as {
  searchCommentsByLecture: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
  it("document context: shows heading select, blockquote, code-block, list, table, hr, image", () => {
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="document" />);
    expect(screen.getByLabelText(/тип блока/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/цитата/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/блок кода/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/маркированный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/нумерованный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/таблица/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/горизонтальная линия/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/изображение/i)).toBeInTheDocument();
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
    expect(screen.queryByLabelText(/изображение/i)).toBeNull();
    // inline marks + link still present (always-allowed)
    expect(screen.getByLabelText(/жирный/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ссылка/i)).toBeInTheDocument();
    editor.destroy();
  });
});

describe("EditorToolbar defaultLectureId", () => {
  it("прокидывает defaultLectureId до Comment2StagePicker (сразу шаг 2)", async () => {
    mockedActions.searchCommentsByLecture.mockResolvedValue({ data: [], total: 0 });
    const navSchema: SchemaSnapshot = {
      ...fullSchema,
      marks: new Map([["lecture_ref", { attrs: {} }]]),
    };
    const editor = makeEditor("document");
    render(
      <EditorToolbar
        editor={editor}
        schema={navSchema}
        context="document"
        defaultLectureId="L42"
      />,
    );
    fireEvent.click(screen.getByLabelText(/вставить ссылку на сущность/i));
    fireEvent.click(await screen.findByRole("button", { name: "Комментарий" }));
    expect(await screen.findByText(/шаг 2/i)).toBeInTheDocument();
    editor.destroy();
  });
});
