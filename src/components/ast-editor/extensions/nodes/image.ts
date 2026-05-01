import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "./image-node-view";

/**
 * AST `image` block. Atomic (no inline content). attrs:
 *   - storage_key: hex64 (required, validated by attr-plugin)
 *   - alt: ≤1000 chars
 *   - caption: ≤1000 chars
 *   - blockId: top-level Block ID
 *
 * NodeView is React-driven: alt/caption are edited via overlay inputs while
 * the node is selected (figcaption stays out of PM content model — node is
 * `atom: true` to keep AST round-trip clean).
 */
export const ImageExt = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      storage_key: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-storage-key") ?? "",
        renderHTML: (attrs: { storage_key?: string }) =>
          attrs.storage_key ? { "data-storage-key": attrs.storage_key } : {},
      },
      alt: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-alt") ?? "",
        renderHTML: (attrs: { alt?: string }) =>
          attrs.alt ? { "data-alt": attrs.alt } : {},
      },
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") ?? "",
        renderHTML: (attrs: { caption?: string }) =>
          attrs.caption ? { "data-caption": attrs.caption } : {},
      },
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-ast-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-ast-image": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
