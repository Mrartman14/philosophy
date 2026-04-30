import Heading from "@tiptap/extension-heading";

export const HeadingExt = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-heading-id"),
        renderHTML: (attrs: { id?: string | null }) =>
          attrs.id ? { "data-heading-id": attrs.id } : {},
      },
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },
}).configure({ levels: [1, 2, 3, 4, 5, 6] });
