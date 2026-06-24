// src/components/ast-editor/pickers/at-menu.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Editor, Extension } from "@tiptap/core";
import { describe, it, expect, vi, afterEach } from "vitest";

// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru/editor.
// Если ключа в каталоге нет, переводчик возвращает сам ключ (этого достаточно
// для тестов, которые не завязаны на конкретный текст перевода).
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string, args?: Record<string, unknown>) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val === "string") return val;
        const suffix = args ? ` ${Object.values(args).filter((v) => v !== "").join(" ")}` : "";
        return `${key}${suffix}`.trimEnd();
      };
    },
  };
});

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

import * as actions from "./actions";
import { AtMenu } from "./at-menu";
import { createAtSuggestionPlugin, atSuggestionKey } from "./at-suggestion-plugin";

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

/** Открывает AtMenu, имитируя handleTextInput: "@" в doc + meta плагина. */
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
    // Combobox-попап рендерится только при open; в закрытом состоянии item-ов нет.
    expect(screen.queryByRole("option")).toBeNull();
    editor.destroy();
  });

  it("открывается по '@' и рендерит пикер (по умолчанию ищет глоссарий)", async () => {
    mocked.searchGlossary.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);

    openMenu(editor);

    // Категория «Термин» (глоссарий) активна по умолчанию → сразу ищет глоссарий.
    expect(await screen.findByText("L1")).toBeInTheDocument();
    expect(mocked.searchGlossary).toHaveBeenCalled();
    editor.destroy();
  });

  it("выбор термина вставляет glossary_ref и удаляет '@'-маркер (consumeAtMarker)", async () => {
    mocked.searchGlossary.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);

    openMenu(editor);

    // Глоссарий активен сразу — кликаем по найденному термину (click-to-select).
    fireEvent.click(await screen.findByText("L1"));

    // "@" удалён consumeAtMarker, вставлен label с маркой.
    expect(editor.getText()).toBe("L1");
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"glossary_ref"');
    expect(json).toContain('"id":"l1"');
    // Терминальный выбор закрыл состояние → пикер скрыт (через transaction-listener).
    await waitFor(() => { expect(screen.queryByRole("option")).toBeNull(); });
    editor.destroy();
  });

  it("якорится под каретку через Base UI Positioner (coordsAtPos), а не в поток", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "l1", title: "L1" }], total: 1 });
    const editor = makeEditor();
    // Позиционирование делегировано Base UI Combobox.Positioner: якорь — virtual
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

    // Пикер портализуется на body и якорится к каретке → coordsAtPos должен быть
    // вызван при замере позиции anchor.
    await screen.findByText("L1");
    await waitFor(() => { expect(coordsSpy).toHaveBeenCalled(); });

    editor.destroy();
  });

  it("Escape закрывает пикер и возвращает фокус в редактор", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "l1", title: "L1" }], total: 1 });
    const editor = makeEditor();
    // editor.commands.focus() в итоге зовёт editor.view.focus — шпионим по нему
    // (focus-команда — геттер, создающий новый объект на каждый вызов).
    const viewFocusSpy = vi.spyOn(editor.view, "focus").mockImplementation(vi.fn());

    render(<AtMenu editor={editor} />);

    openMenu(editor);

    // Дожидаемся открытия пикера и фокуса внутрь поиска (combobox input).
    const input = await screen.findByRole("combobox");
    await waitFor(() => { expect(input).toHaveFocus(); });

    // Escape → dismiss Base UI → onOpenChange(false) → closeAtSuggestion + фокус
    // в редактор.
    fireEvent.keyDown(input, { key: "Escape", bubbles: true });

    await waitFor(() => { expect(screen.queryByRole("option")).toBeNull(); });
    await waitFor(() => { expect(viewFocusSpy).toHaveBeenCalled(); });

    editor.destroy();
  });

  it("клик-вне закрывает пикер через onOpenChange и возвращает фокус", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "l1", title: "L1" }], total: 1 });
    const editor = makeEditor();
    const viewFocusSpy = vi.spyOn(editor.view, "focus").mockImplementation(vi.fn());

    render(<AtMenu editor={editor} />);
    openMenu(editor);
    await screen.findByText("L1");

    // Клик мимо попапа → Base UI Combobox dismiss → onOpenChange(false) →
    // closeAtSuggestion + возврат фокуса в редактор.
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);

    await waitFor(() => { expect(screen.queryByRole("option")).toBeNull(); });
    await waitFor(() => { expect(viewFocusSpy).toHaveBeenCalled(); });
    editor.destroy();
  });
});
