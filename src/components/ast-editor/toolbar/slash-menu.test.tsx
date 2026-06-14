// src/components/ast-editor/toolbar/slash-menu.test.tsx
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { Editor, Extension } from "@tiptap/core";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SlashMenu } from "./slash-menu";
import { createSlashMenuPlugin, slashMenuKey } from "./slash-menu-plugin";
import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

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
    const { container } = render(
      <SlashMenu editor={editor} schema={SchemaSnap} context="document" />,
    );
    // Open via meta directly — UI-кейс не зависит от пути открытия.
    const pos = editor.view.state.selection.from;
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("/", pos)
        .setMeta(slashMenuKey, { open: true, from: pos, query: "" }),
    );
    await waitFor(() =>
      { expect(container.querySelector('[role="listbox"]')).not.toBeNull(); },
    );
    fireEvent.mouseDown(screen.getByText(/заголовок 1/i));
    expect(JSON.stringify(editor.getJSON())).toContain('"type":"heading"');
    editor.destroy();
  });
});
