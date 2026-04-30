import CodeBlock from "@tiptap/extension-code-block";

/**
 * Tiptap default node-name is "codeBlock" (camelCase) — rename to AST
 * canonical "code_block" so PM round-trips into AST without aliasing.
 */
export const CodeBlockExt = CodeBlock.extend({
  name: "code_block",

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-language"),
        renderHTML: (attrs: { language?: string | null }) =>
          attrs.language ? { "data-language": attrs.language } : {},
      },
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },
});
