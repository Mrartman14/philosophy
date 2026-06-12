import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { Editor } from "@tiptap/core";
import * as actions from "./actions";
import { RefMenu } from "./ref-menu";
import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

const mocked = actions as unknown as { searchLectures: ReturnType<typeof vi.fn> };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const fullSnapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

function makeEditor() {
  const ed = new Editor({
    extensions: buildExtensions({ snapshot: fullSnapshot, context: "document" }),
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] },
  });
  ed.commands.setTextSelection({ from: 1, to: 6 }); // select "hello"
  return ed;
}

describe("RefMenu", () => {
  it("inserts lecture_ref mark with selected id on lecture pick", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    const onClose = vi.fn();
    render(<RefMenu editor={editor} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /лекция/i }));
    fireEvent.mouseDown(await screen.findByText("L1"));
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"lecture_ref"');
    expect(json).toContain('"id":"l1"');
    expect(onClose).toHaveBeenCalledOnce();
    editor.destroy();
  });

  it("inserts text+mark on collapsed selection (label rendered as visible text)", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = new Editor({
      extensions: buildExtensions({ snapshot: fullSnapshot, context: "document" }),
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] },
    });
    // collapsed cursor at end of "hello" (offset 6)
    editor.commands.setTextSelection(6);

    render(<RefMenu editor={editor} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /лекция/i }));
    fireEvent.mouseDown(await screen.findByText("L1"));

    // Visible text uses the human-readable title ("L1"), mark still carries id "l1".
    expect(editor.getText()).toContain("L1");
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"lecture_ref"');
    expect(json).toContain('"id":"l1"');
    editor.destroy();
  });

  it("не показывает категорию Canvas (canvas вне скоупа — dormant)", () => {
    const editor = makeEditor();
    render(<RefMenu editor={editor} />);
    expect(screen.queryByRole("button", { name: /canvas/i })).toBeNull();
    // Остальные пять категорий на месте.
    for (const name of ["Лекция", "Термин", "Документ", "Медиа", "Комментарий"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    editor.destroy();
  });

  it("onWillInsert вызывается до вставки mark", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    const onWillInsert = vi.fn();
    render(<RefMenu editor={editor} onWillInsert={onWillInsert} />);
    fireEvent.click(screen.getByRole("button", { name: /лекция/i }));
    fireEvent.mouseDown(await screen.findByText("L1"));
    expect(onWillInsert).toHaveBeenCalledOnce();
    expect(JSON.stringify(editor.getJSON())).toContain('"type":"lecture_ref"');
    editor.destroy();
  });
});
