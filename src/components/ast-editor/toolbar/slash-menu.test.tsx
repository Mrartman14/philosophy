// src/components/ast-editor/toolbar/slash-menu.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Editor, Extension } from "@tiptap/core";
import { describe, it, expect, afterEach, vi } from "vitest";

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

import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

import { SlashMenu } from "./slash-menu";
import { createSlashMenuPlugin, slashMenuKey } from "./slash-menu-plugin";

afterEach(cleanup);

const SchemaSnap: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "heading", "list", "thematic_break"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100, maxContentItems: 100, maxMarksPerNode: 10 },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const slashHost = Extension.create({
  name: "slash-menu-host",
  addProseMirrorPlugins() {
    return [createSlashMenuPlugin()];
  },
});

function makeEditor() {
  return new Editor({
    extensions: [
      ...buildExtensions({ snapshot: SchemaSnap, context: "document" }),
      slashHost,
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

describe("createSlashMenuPlugin", () => {
  it("handleTextInput opens state when '/' typed in empty paragraph", () => {
    const editor = makeEditor();
    const view = editor.view;
    const pos = view.state.selection.from; // inside empty paragraph
    const handled = view.someProp("handleTextInput", (fn) =>
      fn(view, pos, pos, "/", () => view.state.tr),
    );
    // Our plugin returns false to let "/" insert normally
    // someProp returns the first truthy result; false is falsy so returns undefined
    expect(handled).toBeFalsy();
    const state = slashMenuKey.getState(view.state);
    expect(state?.open).toBe(true);
    expect(state?.from).toBe(pos);
    editor.destroy();
  });
});

describe("SlashMenu UI", () => {
  it("renders palette when state is open and applies heading on click", async () => {
    const editor = makeEditor();
    // Контент меню портализуется Base UI на body → ищем через screen.
    render(<SlashMenu editor={editor} schema={SchemaSnap} context="document" />);
    // Open via meta directly — UI-кейс не зависит от пути открытия.
    const pos = editor.view.state.selection.from;
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("/", pos)
        .setMeta(slashMenuKey, { open: true, from: pos, query: "" }),
    );
    await screen.findByRole("listbox");
    fireEvent.mouseDown(screen.getByText(/заголовок 1/i));
    expect(JSON.stringify(editor.getJSON())).toContain('"type":"heading"');
    editor.destroy();
  });

  it("якорится под каретку через Base UI Positioner (coordsAtPos)", async () => {
    const editor = makeEditor();
    // Позиционирование делегировано Base UI Popover.Positioner: якорь — virtual
    // element поверх coordsAtPos (caret-anchor.ts). jsdom отдаёт нули, мокаем.
    const coordsSpy = vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({
      top: 150,
      bottom: 168,
      left: 40,
      right: 46,
    });
    render(<SlashMenu editor={editor} schema={SchemaSnap} context="document" />);
    const pos = editor.view.state.selection.from;
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("/", pos)
        .setMeta(slashMenuKey, { open: true, from: pos, query: "" }),
    );
    // Контент портализуется на body → ищем через screen, не через container.
    await screen.findByRole("listbox");
    await waitFor(() => { expect(coordsSpy).toHaveBeenCalled(); });

    editor.destroy();
  });

  it("listbox and options have stable ids for aria-activedescendant bridge", async () => {
    const editor = makeEditor();
    render(<SlashMenu editor={editor} schema={SchemaSnap} context="document" />);
    const pos = editor.view.state.selection.from;
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("/", pos)
        .setMeta(slashMenuKey, { open: true, from: pos, query: "" }),
    );
    // Контент портализуется на body → запросы через screen, не через container.
    const listbox = await screen.findByRole("listbox");

    // Listbox must have a stable non-empty id.
    const listboxId = listbox.getAttribute("id");
    expect(listboxId).toBeTruthy();

    // Each option must have an id in the form `${listboxId}-opt-${i}`.
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    options.forEach((opt, i) => {
      expect(opt.getAttribute("id")).toBe(`${listboxId}-opt-${i}`);
    });

    // editor.view.dom must have aria-controls pointing to the listbox and
    // aria-activedescendant pointing to the first option (index 0 on open).
    const editorDom = editor.view.dom;
    expect(editorDom.getAttribute("aria-controls")).toBe(listboxId);
    expect(editorDom.getAttribute("aria-activedescendant")).toBe(`${listboxId}-opt-0`);

    editor.destroy();
  });

  it("removes aria bridge attrs from editor.view.dom after menu closes", async () => {
    const editor = makeEditor();
    render(<SlashMenu editor={editor} schema={SchemaSnap} context="document" />);
    const pos = editor.view.state.selection.from;
    // Open the menu.
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("/", pos)
        .setMeta(slashMenuKey, { open: true, from: pos, query: "" }),
    );
    // Контент портализуется на body → запросы через screen, не через container.
    await screen.findByRole("listbox");
    // Close the menu.
    editor.view.dispatch(
      editor.view.state.tr.setMeta(slashMenuKey, { open: false, from: -1, query: "" }),
    );
    await waitFor(() =>
      { expect(screen.queryByRole("listbox")).toBeNull(); },
    );
    const editorDom = editor.view.dom;
    expect(editorDom.getAttribute("aria-controls")).toBeNull();
    expect(editorDom.getAttribute("aria-activedescendant")).toBeNull();
    editor.destroy();
  });
});
