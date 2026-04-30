import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";

export const TableExt = Table.configure({ resizable: false });

export const TableRowExt = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      header: { default: false },
      blockId: { default: "" },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const attrs = {
      ...HTMLAttributes,
      ...(node.attrs.header ? { "data-header": "true" } : {}),
      ...(node.attrs.blockId ? { "data-block-id": node.attrs.blockId } : {}),
    };
    return ["tr", attrs, 0];
  },
});

export const TableCellExt = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: { default: null },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const tag = "td";
    const attrs = {
      ...HTMLAttributes,
      ...(node.attrs.align ? { "data-align": node.attrs.align } : {}),
    };
    return [tag, attrs, 0];
  },
});
