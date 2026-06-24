import { Node } from "@tiptap/core";

import { domSpecFromNode } from "../render-from-map";

/**
 * AST table tree: table > table_row+ > table_cell > (text | hard_break)*.
 * Authored from scratch (instead of extending @tiptap/extension-table*) because:
 *  - Tiptap defaults register as camelCase (tableRow / tableCell), but AST
 *    canonicals are snake_case — round-trip via PM would emit invalid types.
 *  - Tiptap's default table_cell content is "block+" (paragraph nesting), but
 *    AST table_cell holds inline text directly.
 * blockId lives only on top-level Block (table); rows/cells are AST Nodes
 * without their own id.
 */

export const TableExt = Node.create({
  name: "table",
  group: "block",
  content: "table_row+",
  isolating: true,
  // @ts-expect-error tableRole — поле аугментации @tiptap/pm/tables (этим самописным extension не импортируется); читается ProseMirror в рантайме.
  tableRole: "table",

  addAttributes() {
    return {
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "table" }];
  },

  // node→DOM делегируется единой карте: `<table>` > `<tbody>` (HOLE). Карта НЕ
  // несёт `data-block-id` (table — read-нода без id-attr в карте), но в
  // редакторе table — верхнеуровневый Block и хранит blockId для round-trip —
  // накладываем его СВЕРХУ через HTMLAttributes на структурную базу.
  renderHTML({ node, HTMLAttributes }) {
    const spec = domSpecFromNode(node.type.name, node.attrs);
    if (!Array.isArray(spec)) {
      return spec;
    }
    const [tag, base, ...rest] = spec as [string, Record<string, string>, ...unknown[]];
    return [tag, { ...base, ...HTMLAttributes }, ...rest] as typeof spec;
  },
});

export const TableRowExt = Node.create({
  name: "table_row",
  content: "table_cell+",
  // @ts-expect-error tableRole — поле аугментации @tiptap/pm/tables (не импортируется); читается ProseMirror в рантайме.
  tableRole: "row",

  addAttributes() {
    // default: null (not false) — AST treats absent and `false` as the same;
    // declaring null as default lets the serializer drop the attr entirely
    // when unset, keeping AST output minimal.
    return {
      header: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "tr" }];
  },

  // node→DOM делегируется единой карте: `<tr data-header?>`.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});

export const TableCellExt = Node.create({
  name: "table_cell",
  content: "(text | hard_break)*",
  isolating: true,
  // @ts-expect-error tableRole — поле аугментации @tiptap/pm/tables (не импортируется); читается ProseMirror в рантайме.
  tableRole: "cell",

  addAttributes() {
    return {
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-align"),
        renderHTML: (attrs: { align?: string | null }) =>
          attrs.align ? { "data-align": attrs.align } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "td" }, { tag: "th" }];
  },

  // node→DOM делегируется единой карте: `<td data-align?>`. Редактор всегда
  // рендерит `<td>` (карта `table_cell` → td); `<th>` для header-строк — это
  // read-only апгрейд (per-node renderHTML не знает родителя). Зафиксированная
  // законная дивергенция edit↔read.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});
