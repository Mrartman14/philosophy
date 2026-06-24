import Blockquote from "@tiptap/extension-blockquote";

import { domSpecFromNode } from "../render-from-map";

export const BlockquoteExt = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },

  // node→DOM делегируется единой карте (паритет read/edit).
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});
