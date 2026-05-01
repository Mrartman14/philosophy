// src/components/ast-editor/toolbar/slash-menu-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface SlashMenuState {
  open: boolean;
  from: number; // позиция "/", чтобы закрыть/удалить
  query: string;
}

export const slashMenuKey = new PluginKey<SlashMenuState>("ast-editor-slash-menu");

export function createSlashMenuPlugin() {
  return new Plugin<SlashMenuState>({
    key: slashMenuKey,
    state: {
      init: () => ({ open: false, from: -1, query: "" }),
      apply(tr, prev) {
        const meta = tr.getMeta(slashMenuKey) as Partial<SlashMenuState> | undefined;
        if (meta) return { ...prev, ...meta };
        if (!prev.open) return prev;
        // Map prev.from через mapping любых правок других плагинов (например
        // dedup-block-id-plugin), иначе позиция "/" устареет и textBetween
        // вернёт мусор.
        const mappedFrom = tr.mapping.map(prev.from, -1);
        if (tr.docChanged) {
          const end = tr.selection.from;
          if (end < mappedFrom) return { open: false, from: -1, query: "" };
          const text = tr.doc.textBetween(mappedFrom, end);
          if (!text.startsWith("/")) return { open: false, from: -1, query: "" };
          return { ...prev, from: mappedFrom, query: text.slice(1) };
        }
        return { ...prev, from: mappedFrom };
      },
    },
    props: {
      handleTextInput(view, from, _to, text) {
        if (text !== "/") return false;
        const state = slashMenuKey.getState(view.state);
        if (state?.open) return false;
        // Open only at start of empty paragraph
        const $from = view.state.doc.resolve(from);
        const inEmpty =
          $from.parent.type.name === "paragraph" && $from.parent.textContent.length === 0;
        if (!inEmpty) return false;
        const tr = view.state.tr.setMeta(slashMenuKey, { open: true, from, query: "" });
        view.dispatch(tr);
        return false; // let "/" be inserted normally
      },
      handleKeyDown(view, event) {
        const s = slashMenuKey.getState(view.state);
        if (!s?.open) return false;
        if (event.key === "Escape") {
          view.dispatch(
            view.state.tr.setMeta(slashMenuKey, { open: false, from: -1, query: "" }),
          );
          return true;
        }
        return false;
      },
    },
  });
}

export function closeSlashMenu(view: import("@tiptap/pm/view").EditorView) {
  view.dispatch(view.state.tr.setMeta(slashMenuKey, { open: false, from: -1, query: "" }));
}

export function consumeSlashMarker(
  view: import("@tiptap/pm/view").EditorView,
  from: number,
) {
  // Удаляет "/" + query, оставляет курсор готовым для вставки
  const to = view.state.selection.from;
  view.dispatch(
    view.state.tr
      .delete(from, to)
      .setMeta(slashMenuKey, { open: false, from: -1, query: "" }),
  );
}
