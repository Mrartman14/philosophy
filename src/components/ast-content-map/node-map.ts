import {
  blockIdAttr,
  cellAlignAttr,
  codeBlockAttrs,
  headingTag,
  imageChildren,
  isOrdered,
  listAttrs,
  listItemAttrs,
  listItemChildren,
} from "./attrs";
import { HOLE, type AstNodeType, type NodeRenderer } from "./types";

export const NODE_MAP: Partial<Record<AstNodeType, NodeRenderer>> = {
  paragraph: (node) => ["p", blockIdAttr(node), HOLE],
  heading: (node) => [headingTag(node), blockIdAttr(node), HOLE],
  blockquote: (node) => ["blockquote", blockIdAttr(node), HOLE],
  thematic_break: (node) => ["hr", blockIdAttr(node)],
  list: (node) => [isOrdered(node) ? "ol" : "ul", listAttrs(node), HOLE],
  // list_item: задача (checked != null) несёт disabled-чекбокс + обёртку контента
  // <div class="task-content"> (PM требует content-hole единственным ребёнком, см.
  // node-map.test). Обычный пункт — только HOLE (диск/номер из CSS).
  list_item: (node) => {
    const checkbox = listItemChildren(node)[0];
    return checkbox === undefined
      ? ["li", listItemAttrs(node), HOLE]
      : ["li", listItemAttrs(node), checkbox, ["div", { class: "task-content" }, HOLE]];
  },
  code_block: (node) => ["pre", codeBlockAttrs(node), ["code", {}, HOLE]],
  // image: НЕ несёт data-block-id (контракт аннотаций). Лист с вычисленными детьми.
  image: (node) => ["figure", {}, ...imageChildren(node)],
  // table: БЕЗ data-block-id. tbody-обёртка, дети-строки в HOLE.
  table: () => ["table", {}, ["tbody", {}, HOLE]],
  table_row: (node) => [
    "tr",
    (node.attrs as { header?: unknown } | undefined)?.header === true ? { "data-header": "true" } : {},
    HOLE,
  ],
  // table_cell: базово <td>. READ-адаптер апгрейдит до <th scope=col> в header-строке
  // (per-node renderHTML редактора не знает родителя → th только в read).
  table_cell: (node) => ["td", cellAlignAttr(node), HOLE],
};
