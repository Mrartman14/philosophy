import { Node } from "@tiptap/core";

import { domSpecFromNode } from "../render-from-map";

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

  parseHTML() {
    return [{ tag: "li" }];
  },

  // node→DOM делегируется единой карте: `<li data-block-id? data-checked?>`.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});
