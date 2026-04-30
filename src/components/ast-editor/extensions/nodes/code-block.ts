import CodeBlock from "@tiptap/extension-code-block";

export const CodeBlockExt = CodeBlock.extend({
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
