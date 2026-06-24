import CodeBlock from "@tiptap/extension-code-block";

import { blockIdPmAttr } from "../block-id-attr";
import { domSpecFromNode } from "../render-from-map";

/**
 * Tiptap default node-name is "codeBlock" (camelCase) — rename to AST
 * canonical "code_block" so PM round-trips into AST without aliasing.
 */
export const CodeBlockExt = CodeBlock.extend({
  name: "code_block",

  // node→DOM делегируется единой карте: `<pre data-block-id dir=ltr
  // data-language?>` > `<code>`. addAttributes отвечает за parse/storage.
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-language"),
        renderHTML: (attrs: { language?: string | null }) =>
          attrs.language ? { "data-language": attrs.language } : {},
      },
      blockId: blockIdPmAttr(),
    };
  },
});
