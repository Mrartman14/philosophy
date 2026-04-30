import { Node, mergeAttributes } from "@tiptap/core";

export const ImageExt = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      storage_key: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      blockId: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-ast-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, { "data-ast-image": "" });
    return ["figure", attrs];
  },
});
