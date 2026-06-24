import HorizontalRule from "@tiptap/extension-horizontal-rule";

import { blockIdPmAttr } from "../block-id-attr";
import { domSpecFromNode } from "../render-from-map";

/**
 * AST `thematic_break` ↔ Tiptap HorizontalRule.
 * The Tiptap node-name for HorizontalRule is "horizontalRule" by default;
 * we rename it to "thematic_break" so PM doc shape matches the AST 1:1
 * without aliasing in serializer/deserializer.
 */
export const ThematicBreakExt = HorizontalRule.extend({
  name: "thematic_break",

  // node→DOM делегируется единой карте: `<hr data-block-id>` (лист, без HOLE).
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: blockIdPmAttr(),
    };
  },
});
