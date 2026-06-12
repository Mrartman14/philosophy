// src/components/ast-editor/pickers/at-suggestion-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface AtSuggestionState {
  open: boolean;
  from: number; // позиция "@" — чтобы удалить маркер при вставке
  query: string;
}

export const atSuggestionKey = new PluginKey<AtSuggestionState>(
  "ast-editor-at-suggestion",
);

const CLOSED: AtSuggestionState = { open: false, from: -1, query: "" };

/**
 * "@"-suggestion: печать "@" в начале текста или после пробела открывает
 * AtMenu (RefMenu inline). Зеркало slash-menu-plugin (toolbar/slash-menu-plugin.ts):
 * state {open, from, query}, mapping позиций через tr.mapping, закрытие при
 * потере "@" в начале маркера и по Esc.
 */
export function createAtSuggestionPlugin() {
  return new Plugin<AtSuggestionState>({
    key: atSuggestionKey,
    state: {
      init: () => CLOSED,
      apply(tr, prev) {
        const meta = tr.getMeta(atSuggestionKey) as Partial<AtSuggestionState> | undefined;
        if (meta) return { ...prev, ...meta };
        if (!prev.open) return prev;
        // Map prev.from через mapping любых правок других плагинов, иначе
        // позиция "@" устареет и textBetween вернёт мусор.
        const mappedFrom = tr.mapping.map(prev.from, -1);
        const end = tr.selection.from;
        if (tr.docChanged) {
          if (end < mappedFrom) return CLOSED;
          const text = tr.doc.textBetween(mappedFrom, end);
          if (!text.startsWith("@")) return CLOSED;
          // Enter/split: textBetween с blockSeparator "" склеивает текст через
          // границу блока, startsWith("@") остаётся true, хотя курсор уже в
          // другом блоке. Расхождение длины текста и диапазона = escape.
          if (end - mappedFrom !== text.length) return CLOSED;
          return { ...prev, from: mappedFrom, query: text.slice(1) };
        }
        // Selection-only транзакция (клик мышью, End/стрелки): курсор вне
        // диапазона "@"+query — закрываем, иначе consumeAtMarker удалит
        // чужой текст или получит to < from.
        if (
          tr.selectionSet &&
          (end < mappedFrom || end > mappedFrom + 1 + prev.query.length)
        ) {
          return CLOSED;
        }
        return { ...prev, from: mappedFrom };
      },
    },
    props: {
      handleTextInput(view, from, _to, text) {
        if (text !== "@") return false;
        const state = atSuggestionKey.getState(view.state);
        if (state?.open) return false;
        const $from = view.state.doc.resolve(from);
        if (!$from.parent.isTextblock) return false;
        // Только в начале текста или после пробельного символа — "@" внутри
        // слова (например, e-mail) меню не открывает.
        const before = $from.parent.textBetween(0, $from.parentOffset, "￼", "￼");
        if (before.length > 0 && !/\s$/.test(before)) return false;
        view.dispatch(
          view.state.tr.setMeta(atSuggestionKey, { open: true, from, query: "" }),
        );
        return false; // "@" вставляется как обычный текст
      },
      handleKeyDown(view, event) {
        const s = atSuggestionKey.getState(view.state);
        if (!s?.open) return false;
        if (event.key === "Escape") {
          view.dispatch(view.state.tr.setMeta(atSuggestionKey, CLOSED));
          return true;
        }
        return false;
      },
    },
  });
}

export function closeAtSuggestion(view: import("@tiptap/pm/view").EditorView) {
  view.dispatch(view.state.tr.setMeta(atSuggestionKey, CLOSED));
}

/** Удаляет "@"+query из документа и закрывает состояние (selection схлопывается в from). */
export function consumeAtMarker(
  view: import("@tiptap/pm/view").EditorView,
  from: number,
) {
  const to = view.state.selection.from;
  // Guard: если курсор уехал до маркера (to < from), delete(from, to) с
  // перевёрнутым диапазоном портит документ — только закрываем состояние.
  const tr = view.state.tr;
  if (to > from) tr.delete(from, to);
  view.dispatch(tr.setMeta(atSuggestionKey, CLOSED));
}
