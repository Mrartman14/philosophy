/**
 * Single source of truth for the `blockId` ProseMirror attribute spec.
 *
 * `data-block-id` is the annotation substrate anchor — every top-level Block
 * carries it for round-trip (parse from `data-block-id`, render back to it).
 * The spec was previously copy-pasted verbatim into 7 node extensions; drift
 * in one copy would silently break anchors for that block type. Keep it here.
 *
 * Returns a plain object usable directly in a Tiptap `addAttributes()` return,
 * e.g. `{ ...this.parent?.(), blockId: blockIdPmAttr() }`.
 */
export function blockIdPmAttr() {
  return {
    default: "",
    parseHTML: (el: HTMLElement) =>
      el.getAttribute("data-block-id") ?? el.getAttribute("data-node-id") ?? "",
    renderHTML: (attrs: { blockId?: string }) =>
      attrs.blockId ? { "data-block-id": attrs.blockId } : {},
  };
}
