// src/components/ast-editor/pickers/at-menu.test.tsx
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { Editor, Extension } from "@tiptap/core";
import * as actions from "./actions";
import { AtMenu } from "./at-menu";
import { createAtSuggestionPlugin, atSuggestionKey } from "./at-suggestion-plugin";
import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

const mocked = actions as unknown as { searchLectures: ReturnType<typeof vi.fn> };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const snapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const atHost = Extension.create({
  name: "at-suggestion-host",
  addProseMirrorPlugins() {
    return [createAtSuggestionPlugin()];
  },
});

function makeEditor() {
  return new Editor({
    extensions: [...buildExtensions({ snapshot, context: "document" }), atHost],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

describe("AtMenu", () => {
  it("скрыт, пока plugin-state закрыт", () => {
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    editor.destroy();
  });

  it("открывается по '@', вставляет lecture_ref и удаляет маркер", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);

    // Открываем так же, как это делает handleTextInput: "@" в doc + meta.
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );

    expect(
      await screen.findByRole("dialog", { name: /вставить ссылку/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Лекция" }));
    fireEvent.mouseDown(await screen.findByText("L1"));

    // "@" удалён, вставлен label с mark.
    expect(editor.getText()).toBe("L1");
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"lecture_ref"');
    expect(json).toContain('"id":"l1"');
    // Состояние закрыто → меню скрыто (через transaction-listener, ждём React).
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    editor.destroy();
  });
});
