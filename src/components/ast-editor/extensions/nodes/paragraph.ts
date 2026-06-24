import Paragraph from "@tiptap/extension-paragraph";

import { domSpecFromNode } from "../render-from-map";

export const ParagraphExt = Paragraph.extend({
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

  // node→DOM делегируется единой карте (паритет read/edit). Структурную базу
  // (`<p data-block-id>`) даёт карта; addAttributes отвечает за parse/storage.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
});
