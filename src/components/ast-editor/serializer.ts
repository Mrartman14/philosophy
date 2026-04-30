import type { AstBlock, AstNode, AstMark } from "./types";

export interface ProseMirrorJSON {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorJSON[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const LEAF_BLOCK_TYPES = new Set(["code_block", "image", "thematic_break"]);

export function serialize(doc: ProseMirrorJSON): AstBlock[] {
  if (doc.type !== "doc" || !doc.content) return [];
  return doc.content.map((node, i) => serializeBlock(node, i));
}

function serializeBlock(node: ProseMirrorJSON, position: number): AstBlock {
  const id = (node.attrs?.blockId as string | undefined) ?? "";
  const attrs = stripBlockId(node.attrs);

  if (node.type === "code_block") {
    const text = (node.content ?? []).map((c) => c.text ?? "").join("");
    return {
      id,
      type: node.type,
      position,
      ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
      text,
    };
  }

  if (LEAF_BLOCK_TYPES.has(node.type)) {
    return {
      id,
      type: node.type,
      position,
      ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
      text: "",
    };
  }

  const content = (node.content ?? []).map(serializeNode);
  return {
    id,
    type: node.type,
    position,
    ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(content.length > 0 ? { content } : {}),
    text: extractText(content),
  };
}

function serializeNode(node: ProseMirrorJSON): AstNode {
  const result: AstNode = { type: node.type };
  if (node.attrs) {
    const attrs = stripBlockId(node.attrs);
    if (attrs && Object.keys(attrs).length > 0) result.attrs = attrs;
  }
  if (node.text != null) result.text = node.text;
  if (node.marks && node.marks.length > 0) result.marks = node.marks.map(serializeMark);
  if (node.content && node.content.length > 0) result.content = node.content.map(serializeNode);
  return result;
}

function serializeMark(mark: { type: string; attrs?: Record<string, unknown> }): AstMark {
  const out: AstMark = { type: mark.type };
  if (mark.attrs) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(mark.attrs)) {
      if (v !== null && v !== undefined && v !== "") cleaned[k] = v;
    }
    if (Object.keys(cleaned).length > 0) out.attrs = cleaned;
  }
  return out;
}

function stripBlockId(attrs: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!attrs) return undefined;
  const { blockId, ...rest } = attrs;
  void blockId;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== null && v !== undefined) cleaned[k] = v;
  }
  return cleaned;
}

function extractText(nodes: AstNode[]): string {
  let result = "";
  for (const n of nodes) {
    if (n.text) result += n.text;
    if (n.content) result += extractText(n.content);
  }
  return result;
}
