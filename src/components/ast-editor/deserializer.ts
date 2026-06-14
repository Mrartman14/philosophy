import type { AstBlock, AstNode, SchemaSnapshot } from "./types";
import type { ProseMirrorJSON } from "./serializer";

const LEAF_BLOCK_TYPES = new Set(["code_block", "image", "thematic_break"]);

export function deserialize(blocks: AstBlock[], _schema: SchemaSnapshot): ProseMirrorJSON {
  if (!blocks || blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: blocks.map(deserializeBlock),
  };
}

function deserializeBlock(block: AstBlock): ProseMirrorJSON {
  const baseAttrs: Record<string, unknown> = { blockId: block.id ?? "" };
  if (block.attrs) Object.assign(baseAttrs, block.attrs);

  if (block.type === "code_block") {
    return {
      type: "code_block",
      attrs: baseAttrs,
      content: block.text ? [{ type: "text", text: block.text }] : [],
    };
  }

  if (block.type && LEAF_BLOCK_TYPES.has(block.type)) {
    return {
      type: block.type,
      attrs: baseAttrs,
    };
  }

  return {
    type: block.type ?? "paragraph",
    attrs: baseAttrs,
    content: (block.content ?? []).map(deserializeNode),
  };
}

function deserializeNode(node: AstNode): ProseMirrorJSON {
  const out: ProseMirrorJSON = { type: node.type ?? "text" };
  if (node.attrs) out.attrs = { ...node.attrs };
  if (node.text != null) out.text = node.text;
  if (node.marks) {
    out.marks = node.marks.map((m) => ({
      type: m.type ?? "",
      ...(m.attrs ? { attrs: { ...m.attrs } } : {}),
    }));
  }
  if (node.content) out.content = node.content.map(deserializeNode);
  return out;
}
