import Heading from "@tiptap/extension-heading";

import { blockIdPmAttr } from "../block-id-attr";
import { domSpecFromNode } from "../render-from-map";

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
      blockId: blockIdPmAttr(),
    };
  },

  // node→DOM делегируется единой карте: `<h{level} data-block-id?>`. Карта НЕ
  // несёт `data-heading-id` (editor-only round-trip attr) — накладываем его
  // СВЕРХУ на структурную базу, чтобы parseHTML смог его прочитать обратно.
  renderHTML({ node }) {
    const spec = domSpecFromNode(node.type.name, node.attrs);
    const id = node.attrs.id as string | null | undefined;
    if (!id || !Array.isArray(spec)) {
      return spec;
    }
    const [tag, base, ...rest] = spec as [string, Record<string, string>, ...unknown[]];
    return [tag, { ...base, "data-heading-id": id }, ...rest] as typeof spec;
  },
}).configure({ levels: [1, 2, 3, 4, 5, 6] });
