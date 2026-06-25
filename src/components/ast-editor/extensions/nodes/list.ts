import { Node } from "@tiptap/core";
import type { NodeType } from "@tiptap/pm/model";
import { splitListItem, liftListItem, sinkListItem } from "@tiptap/pm/schema-list";
import type { EditorState } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { blockIdPmAttr } from "../block-id-attr";
import { domSpecFromNode } from "../render-from-map";

import { ListItemNodeView } from "./list-item-node-view";

/**
 * checked объемлющего list_item в позиции каретки (null/undefined = обычный пункт,
 * boolean = задача). Нужно, чтобы Enter на задаче плодил новую задачу (checked:false),
 * а на обычном пункте — обычный пункт.
 */
function enclosingItemChecked(state: EditorState, itemType: NodeType): unknown {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === itemType) return $from.node(d).attrs.checked;
  }
  return undefined;
}

export const ListExt = Node.create({
  name: "list",
  group: "block",
  content: "list_item+",

  addAttributes() {
    return {
      ordered: { default: false },
      start: { default: null },
      blockId: blockIdPmAttr(),
    };
  },

  parseHTML() {
    return [
      { tag: "ul[data-list]", attrs: { ordered: false } },
      { tag: "ol[data-list]", attrs: { ordered: true } },
    ];
  },

  // node→DOM делегируется единой карте: `<ul|ol data-block-id? data-list start?>`.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});

export const ListItemExt = Node.create({
  name: "list_item",
  content: "paragraph block*",
  defining: true,

  addAttributes() {
    return {
      checked: { default: null },
    };
  },

  // Команды редактирования списков (split/sink/lift) — каноничные функции
  // @tiptap/pm/schema-list, агностичные к именам нод; StarterKit'овский listItem
  // отключён, поэтому подключаем их здесь сами. Без них Enter делал splitBlock и
  // плодил второй абзац ВНУТРИ пункта (баг). Делегируем через editor.commands.command,
  // чтобы не аугментировать тип Commands.
  addKeyboardShortcuts() {
    const itemType = this.type;

    const splitItem = () =>
      this.editor.commands.command(({ state, dispatch }) => {
        // Новый пункт после задачи — снова задача, но НЕ выполненная.
        const checked = enclosingItemChecked(state, itemType);
        const attrs = typeof checked === "boolean" ? { checked: false } : undefined;
        return splitListItem(itemType, attrs)(state, dispatch);
      });

    const liftAtStart = () =>
      this.editor.commands.command(({ state, dispatch }) => {
        const { $from, empty } = state.selection;
        if (!empty || $from.parentOffset !== 0) return false; // обычный backspace
        const itemDepth = $from.depth - 1;
        if (itemDepth < 0 || $from.node(itemDepth).type !== itemType) return false;
        if ($from.index(itemDepth) !== 0) return false; // не первый блок пункта
        return liftListItem(itemType)(state, dispatch);
      });

    return {
      Enter: splitItem,
      Tab: () => this.editor.commands.command(({ state, dispatch }) => sinkListItem(itemType)(state, dispatch)),
      "Shift-Tab": () => this.editor.commands.command(({ state, dispatch }) => liftListItem(itemType)(state, dispatch)),
      Backspace: liftAtStart,
    };
  },

  parseHTML() {
    return [{ tag: "li" }];
  },

  // node→DOM делегируется единой карте: `<li data-checked? [<input disabled><div>]>`.
  // Это SSR/read-фолбэк; в живом редакторе nodeView ниже переопределяет на
  // интерактивный чекбокс.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },

  // Живой редактор: интерактивный чекбокс задачи (карта даёт лишь disabled-фолбэк).
  addNodeView() {
    return ReactNodeViewRenderer(ListItemNodeView);
  },
});
