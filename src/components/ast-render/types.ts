// src/components/ast-render/types.ts
import type { components } from "@/api/schema";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type AstNodeType = components["schemas"]["ast.NodeType"];
export type AstMarkType = components["schemas"]["ast.MarkType"];

export interface AstRenderProps {
  blocks: AstBlock[];
}
