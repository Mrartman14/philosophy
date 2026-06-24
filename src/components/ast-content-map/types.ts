import type { components } from "@/api/schema";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type AstNodeType = components["schemas"]["ast.NodeType"];
export type AstMarkType = components["schemas"]["ast.MarkType"];

/** Сентинел "сюда идут дети" — совпадает с ProseMirror DOMOutputSpec content-hole. */
export const HOLE = 0 as const;
export type Hole = typeof HOLE;

export type NeutralChild = NeutralSpec | Hole | string;
/** Всегда [tag, attrs, ...children]. Лист: [tag, attrs]. Контейнер: [tag, attrs, HOLE]. */
export type NeutralSpec = [tag: string, attrs: Record<string, string>, ...children: NeutralChild[]];

export type NodeRenderer = (node: AstNode) => NeutralSpec;
export type MarkRenderer = (mark: AstMark) => [tag: string, attrs: Record<string, string>] | null;
