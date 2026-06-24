import { blockIdAttr, headingTag, listAttrs, listItemAttrs } from "./attrs";
import { HOLE, type AstNodeType, type NodeRenderer } from "./types";

export const NODE_MAP: Partial<Record<AstNodeType, NodeRenderer>> = {
  paragraph: (node) => ["p", blockIdAttr(node), HOLE],
  heading: (node) => [headingTag(node), blockIdAttr(node), HOLE],
  blockquote: (node) => ["blockquote", blockIdAttr(node), HOLE],
  thematic_break: (node) => ["hr", blockIdAttr(node)],
  list: (node) => [
    (node.attrs as { ordered?: unknown } | undefined)?.ordered === true ? "ol" : "ul",
    listAttrs(node),
    HOLE,
  ],
  list_item: (node) => ["li", listItemAttrs(node), HOLE],
};
