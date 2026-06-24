import Paragraph from "@tiptap/extension-paragraph";

import { blockIdPmAttr } from "../block-id-attr";
import { domSpecFromNode } from "../render-from-map";

export const ParagraphExt = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: blockIdPmAttr(),
    };
  },

  // node→DOM делегируется единой карте (паритет read/edit). Структурную базу
  // (`<p data-block-id>`) даёт карта; addAttributes отвечает за parse/storage.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});
