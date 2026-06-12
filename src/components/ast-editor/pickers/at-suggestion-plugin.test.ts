// src/components/ast-editor/pickers/at-suggestion-plugin.test.ts
import { describe, it, expect } from "vitest";
import { Editor, Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { buildExtensions } from "../extensions";
import {
  createAtSuggestionPlugin,
  atSuggestionKey,
  consumeAtMarker,
} from "./at-suggestion-plugin";
import type { SchemaSnapshot } from "../types";

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

function makeEditor(text?: string) {
  return new Editor({
    extensions: [...buildExtensions({ snapshot, context: "document" }), atHost],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
      ],
    },
  });
}

describe("createAtSuggestionPlugin", () => {
  it("'@' в пустом параграфе открывает state", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.someProp("handleTextInput", (fn) => fn(view, 1, 1, "@"));
    const s = atSuggestionKey.getState(view.state);
    expect(s?.open).toBe(true);
    expect(s?.from).toBe(1);
    editor.destroy();
  });

  it("'@' после пробела открывает state", () => {
    const editor = makeEditor("foo ");
    const view = editor.view;
    // текст "foo " занимает позиции 1..5, курсор в 5
    view.someProp("handleTextInput", (fn) => fn(view, 5, 5, "@"));
    expect(atSuggestionKey.getState(view.state)?.open).toBe(true);
    editor.destroy();
  });

  it("'@' внутри слова (e-mail) НЕ открывает state", () => {
    const editor = makeEditor("user");
    const view = editor.view;
    view.someProp("handleTextInput", (fn) => fn(view, 5, 5, "@"));
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("consumeAtMarker удаляет '@' и закрывает state", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.dispatch(
      view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );
    expect(editor.getText()).toBe("@");
    consumeAtMarker(view, 1);
    expect(editor.getText()).toBe("");
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("selection-only уход курсора за маркер (End/стрелки) закрывает state", () => {
    const editor = makeEditor("tail");
    const view = editor.view;
    // "@tail": "@" в позиции 1, текст до 6.
    view.dispatch(
      view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );
    expect(atSuggestionKey.getState(view.state)?.open).toBe(true);
    // End: курсор уезжает в конец "tail" — selection-only транзакция.
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 6)),
    );
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("selection-only клик ДО маркера закрывает state", () => {
    const editor = makeEditor("ab ");
    const view = editor.view;
    // "ab @": "@" в позиции 4.
    view.dispatch(
      view.state.tr
        .insertText("@", 4)
        .setMeta(atSuggestionKey, { open: true, from: 4, query: "" }),
    );
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)),
    );
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("selection-only движение в пределах '@'+query НЕ закрывает state", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.dispatch(
      view.state.tr
        .insertText("@ab", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "ab" }),
    );
    // Стрелка влево внутри query: 4 → 3 — меню должно остаться открытым.
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)),
    );
    expect(atSuggestionKey.getState(view.state)?.open).toBe(true);
    editor.destroy();
  });

  it("Enter (split блока) при открытом меню закрывает state", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.dispatch(
      view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );
    // Enter после "@": split переносит курсор в новый блок, textBetween с
    // blockSeparator "" склеивает "@" через границу — state обязан закрыться.
    view.dispatch(view.state.tr.split(2));
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("consumeAtMarker при курсоре ДО маркера не кидает и не удаляет чужой текст", () => {
    const editor = makeEditor("ab ");
    const view = editor.view;
    // "ab @": "@" в позиции 4, курсор уводим в 1 (как клик мышью до маркера).
    view.dispatch(view.state.tr.insertText("@", 4));
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)),
    );
    expect(() => consumeAtMarker(view, 4)).not.toThrow();
    expect(editor.getText()).toBe("ab @");
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("ввод текста после '@' дописывает query, потеря '@' закрывает", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.dispatch(
      view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );
    view.dispatch(view.state.tr.insertText("ab", 2));
    expect(atSuggestionKey.getState(view.state)?.query).toBe("ab");
    // Удаляем весь маркер вместе с query — состояние закрывается.
    view.dispatch(view.state.tr.delete(1, 4));
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });
});
