import Blockquote from "@tiptap/extension-blockquote";

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
});
