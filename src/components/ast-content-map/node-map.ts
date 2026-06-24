import { blockIdAttr, headingTag } from "./attrs";
import { HOLE, type AstNodeType, type NodeRenderer } from "./types";

export const NODE_MAP: Partial<Record<AstNodeType, NodeRenderer>> = {
  paragraph: (node) => ["p", blockIdAttr(node), HOLE],
  heading: (node) => [headingTag(node), blockIdAttr(node), HOLE],
};
