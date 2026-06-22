// src/components/ast-editor/pickers/at-menu.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Editor, Extension } from "@tiptap/core";
import { describe, it, expect, vi, afterEach } from "vitest";

// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      };
    },
  };
});

import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

import * as actions from "./actions";
import { AtMenu } from "./at-menu";
import { createAtSuggestionPlugin, atSuggestionKey } from "./at-suggestion-plugin";

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

const mocked = actions as unknown as { searchGlossary: ReturnType<typeof vi.fn> };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
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

/** Opens the AtMenu by dispatching the plugin state transition */
function openMenu(editor: Editor) {
  editor.view.dispatch(
    editor.view.state.tr
      .insertText("@", 1)
      .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
  );
}

describe("AtMenu", () => {
  it("скрыт, пока plugin-state закрыт", () => {
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    editor.destroy();
  });

  it("открывается по '@', вставляет glossary_ref и удаляет маркер", async () => {
    mocked.searchGlossary.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);

    // Открываем так же, как это делает handleTextInput: "@" в doc + meta.
    openMenu(editor);

    expect(
      await screen.findByRole("dialog", { name: /вставить ссылку/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Термин" }));
    fireEvent.mouseDown(await screen.findByText("L1"));

    // "@" удалён, вставлен label с mark.
    expect(editor.getText()).toBe("L1");
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"glossary_ref"');
    expect(json).toContain('"id":"l1"');
    // Состояние закрыто → меню скрыто (через transaction-listener, ждём React).
    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    editor.destroy();
  });

  it("при открытии фокусирует первую кнопку категории", async () => {
    // Make rAF run the callback synchronously so we can observe focus immediately.
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => { cb(0); return 0; },
    );

    const editor = makeEditor();
    render(<AtMenu editor={editor} />);

    openMenu(editor);

    // role="dialog" должен присутствовать (existing assertion stays green).
    const dialog = await screen.findByRole("dialog", { name: /вставить ссылку/i });
    expect(dialog).toBeInTheDocument();

    // Первая кнопка категории внутри меню получила фокус.
    await waitFor(() => {
      const firstButton = screen.getAllByRole("button")[0];
      expect(firstButton).toHaveFocus();
    });

    editor.destroy();
  });

  it("Escape закрывает меню и возвращает фокус в редактор", async () => {
    // Make rAF run the callback synchronously.
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => { cb(0); return 0; },
    );

    const editor = makeEditor();
    // editor.commands.focus() is a getter returning a new object each call, so spy
    // on editor.view.focus instead — that's what the focus command ultimately calls.
    const viewFocusSpy = vi.spyOn(editor.view, "focus").mockImplementation(vi.fn());

    render(<AtMenu editor={editor} />);

    openMenu(editor);

    // Убеждаемся, что меню открыто и первая кнопка сфокусирована.
    await screen.findByRole("dialog", { name: /вставить ссылку/i });

    // Дожидаемся, пока rAF-фокус отработает.
    await waitFor(() => {
      const firstButton = screen.getAllByRole("button")[0];
      expect(firstButton).toHaveFocus();
    });

    // Нажатие Escape должно закрыть меню.
    // fireEvent.keyDown диспетчирует событие с bubbles:true, его поймает наш
    // document-level capture listener (event.target — кнопка внутри wrapper).
    // getAllByRole всегда возвращает минимум один элемент (иначе throws), поэтому
    // утверждение через non-null assertion безопасно.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstButton = screen.getAllByRole("button")[0]!;
    // Гарантируем, что event.target находится внутри wrapper.
    firstButton.focus();

    fireEvent.keyDown(firstButton, { key: "Escape", bubbles: true });

    // Меню закрывается (через transaction-listener, ждём React).
    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });

    // editor.commands.focus() в итоге вызывает editor.view.focus() через rAF.
    // Поскольку rAF замокан как синхронный вызов, viewFocusSpy уже сработал.
    expect(viewFocusSpy).toHaveBeenCalled();

    editor.destroy();
  });
});
