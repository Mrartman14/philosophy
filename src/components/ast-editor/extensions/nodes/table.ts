import { Node, mergeAttributes } from "@tiptap/core";

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

  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(HTMLAttributes), ["tbody", 0]];
  },
});

export const TableRowExt = Node.create({
  name: "table_row",
  content: "table_cell+",
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

  renderHTML({ HTMLAttributes, node }) {
    const attrs = mergeAttributes(HTMLAttributes, {
      ...(node.attrs.header ? { "data-header": "true" } : {}),
    });
    return ["tr", attrs, 0];
  },
});

export const TableCellExt = Node.create({
  name: "table_cell",
  content: "(text | hard_break)*",
  isolating: true,
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

  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0];
  },
});
