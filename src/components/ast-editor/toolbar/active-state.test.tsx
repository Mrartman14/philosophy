// Регресс: тулбар реактивно отражает активный формат по позиции каретки.
// Покрывает связку useAstEditor(shouldRerenderOnTransaction) → EditorToolbar →
// Toolbar.Button(aria-pressed). Именно aria-pressed драйвит CSS-подсветку
// активного состояния (инверсная заливка в ui/toolbar.tsx).
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { useEffect } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import type { AstBlock, EntityContext, SchemaSnapshot } from "../types";
import { useAstEditor } from "../use-ast-editor";

import { EditorToolbar } from "./toolbar";

// Реальный kit (Toolbar.Button), мокаем только useToast (нет провайдера в тесте).
vi.mock("@/components/ui", async (importActual) => ({
  ...(await importActual<typeof import("@/components/ui")>()),
  useToast: () => ({ add: vi.fn() }),
}));
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
        if (params) return val.replace(/\{(\w+)\}/g, (_: string, k: string) => String(params[k] ?? k));
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

// "ab" обычный + "cd" жирный. Каретка: поз. 2 — внутри обычного, поз. 4 — внутри жирного.
const mixedDoc: AstBlock[] = [
  {
    type: "paragraph",
    attrs: { blockId: "p1" },
    content: [
      { type: "text", text: "ab" },
      { type: "text", text: "cd", marks: [{ type: "bold" }] },
    ],
  } as unknown as AstBlock,
];

function Harness({ onReady }: { onReady: (e: Editor) => void }) {
  const editor = useAstEditor({
    defaultValue: mixedDoc,
    entityContext: "document" as EntityContext,
    schema: fullSchema,
  });
  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);
  if (!editor) return null;
  return <EditorToolbar editor={editor} schema={fullSchema} context="document" />;
}

describe("EditorToolbar активное состояние", () => {
  it("кнопка 'жирный' реактивно переключает aria-pressed по позиции каретки", async () => {
    let ed: Editor | null = null;
    render(<Harness onReady={(e) => { ed = e; }} />);

    await waitFor(() => { expect(ed).not.toBeNull(); });
    const editor = ed as unknown as Editor;
    const boldBtn = await screen.findByLabelText(/жирный/i);

    // Каретка в обычном тексте → не активен.
    act(() => { editor.commands.setTextSelection(2); });
    expect(editor.isActive("bold")).toBe(false);
    expect(boldBtn).toHaveAttribute("aria-pressed", "false");

    // Каретка в жирном тексте → активен (реактивный ре-рендер тулбара).
    act(() => { editor.commands.setTextSelection(4); });
    expect(editor.isActive("bold")).toBe(true);
    expect(boldBtn).toHaveAttribute("aria-pressed", "true");

    // Обратно в обычный → снова не активен.
    act(() => { editor.commands.setTextSelection(2); });
    expect(boldBtn).toHaveAttribute("aria-pressed", "false");
  });
});

// Регресс: чек-лист = ordered:false + checked, поэтому раньше подсвечивалась и
// кнопка маркированного списка (оба ordered:false). Должна быть активна ТОЛЬКО
// кнопка чек-листа.
const checklistDoc: AstBlock[] = [
  {
    id: "l1",
    type: "list",
    attrs: { ordered: false },
    content: [
      {
        type: "list_item",
        attrs: { checked: false },
        content: [{ type: "paragraph", content: [{ type: "text", text: "задача" }] }],
      },
    ],
  } as unknown as AstBlock,
];

function ChecklistHarness({ onReady }: { onReady: (e: Editor) => void }) {
  const editor = useAstEditor({
    defaultValue: checklistDoc,
    entityContext: "document" as EntityContext,
    schema: fullSchema,
  });
  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);
  if (!editor) return null;
  return <EditorToolbar editor={editor} schema={fullSchema} context="document" />;
}

describe("EditorToolbar — режимы списка различаются", () => {
  it("в чек-листе активна ТОЛЬКО кнопка чек-листа (буллет не подсвечен)", async () => {
    let ed: Editor | null = null;
    render(<ChecklistHarness onReady={(e) => { ed = e; }} />);

    await waitFor(() => { expect(ed).not.toBeNull(); });
    const editor = ed as unknown as Editor;
    act(() => { editor.commands.focus("end"); }); // каретка в пункте-задаче

    const bulletBtn = await screen.findByLabelText("Маркированный список");
    const orderedBtn = await screen.findByLabelText("Нумерованный список");
    const taskBtn = await screen.findByLabelText("Чек-лист");

    await waitFor(() => {
      expect(taskBtn).toHaveAttribute("aria-pressed", "true");
    });
    expect(bulletBtn).toHaveAttribute("aria-pressed", "false");
    expect(orderedBtn).toHaveAttribute("aria-pressed", "false");
  });
});
