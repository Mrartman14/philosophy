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

  it("якорится под каретку через Base UI Positioner (coordsAtPos), а не в поток", async () => {
    const editor = makeEditor();
    // Позиционирование делегировано Base UI Popover.Positioner: якорь — virtual
    // element поверх coordsAtPos. coordsAtPos в jsdom даёт нули, мокаем явные
    // координаты — важен сам факт, что floating-ui замеряет каретку.
    const coordsSpy = vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({
      top: 200,
      bottom: 218,
      left: 80,
      right: 86,
    });
    render(<AtMenu editor={editor} />);
    openMenu(editor);

    // Меню портализуется на body (вне in-flow контейнера редактора) и якорится
    // к каретке → coordsAtPos должен быть вызван при замере позиции.
    await screen.findByRole("dialog", { name: /вставить ссылку/i });
    await waitFor(() => { expect(coordsSpy).toHaveBeenCalled(); });

    editor.destroy();
  });

  it("при открытии переносит фокус в меню (первая категория)", async () => {
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);

    openMenu(editor);

    const dialog = await screen.findByRole("dialog", { name: /вставить ссылку/i });
    expect(dialog).toBeInTheDocument();

    // Base UI Popover переносит фокус на первый tabbable в попапе — это кнопка
    // категории "Термин". Имя кнопки устойчивее индекса: Base UI добавляет
    // focus-guard'ы с role="button", и getAllByRole("button")[0] был бы хрупок.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Термин" })).toHaveFocus();
    });

    editor.destroy();
  });

  it("Escape закрывает меню и возвращает фокус в редактор", async () => {
    const editor = makeEditor();
    // editor.commands.focus() is a getter returning a new object each call, so spy
    // on editor.view.focus instead — that's what the focus command ultimately calls.
    const viewFocusSpy = vi.spyOn(editor.view, "focus").mockImplementation(vi.fn());

    render(<AtMenu editor={editor} />);

    openMenu(editor);

    await screen.findByRole("dialog", { name: /вставить ссылку/i });

    // Дожидаемся, пока Base UI перенесёт фокус в меню.
    const firstCategory = await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Термин" });
      expect(btn).toHaveFocus();
      return btn;
    });

    // Escape ловит dismiss Base UI (событие всплывает на document) →
    // onOpenChange(false) → закрытие состояния + возврат фокуса в редактор.
    fireEvent.keyDown(firstCategory, { key: "Escape", bubbles: true });

    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    await waitFor(() => { expect(viewFocusSpy).toHaveBeenCalled(); });

    editor.destroy();
  });
});
