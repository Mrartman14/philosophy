import { Node, mergeAttributes } from "@tiptap/core";

export const ListExt = Node.create({
  name: "list",
  group: "block",
  content: "list_item+",

  addAttributes() {
    return {
      ordered: { default: false },
      start: { default: null },
      blockId: { default: "" },
    };
  },

  parseHTML() {
    return [
      { tag: "ul[data-list]", attrs: { ordered: false } },
      { tag: "ol[data-list]", attrs: { ordered: true } },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const tag = node.attrs.ordered ? "ol" : "ul";
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-list": "",
      ...(node.attrs.ordered && node.attrs.start != null
        ? { start: String(node.attrs.start) }
        : {}),
      ...(node.attrs.blockId ? { "data-block-id": node.attrs.blockId } : {}),
    });
    return [tag, attrs, 0];
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

  parseHTML() {
    return [{ tag: "li" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = mergeAttributes(HTMLAttributes, {
      ...(typeof node.attrs.checked === "boolean"
        ? { "data-checked": node.attrs.checked ? "true" : "false" }
        : {}),
    });
    return ["li", attrs, 0];
  },
});
