import Blockquote from "@tiptap/extension-blockquote";

import { blockIdPmAttr } from "../block-id-attr";
import { domSpecFromNode } from "../render-from-map";

export const BlockquoteExt = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: blockIdPmAttr(),
    };
  },

  // node→DOM делегируется единой карте (паритет read/edit).
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});
