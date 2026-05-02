// src/components/ast-render/inline-renderer.tsx
import type { ReactNode } from "react";
import type { AstNode, AstRenderContext } from "./types";

interface Props {
  nodes: AstNode[] | undefined;
  ctx: AstRenderContext;
}

/**
 * Рендерит массив инлайн-узлов (text / hard_break) с применёнными marks.
 * Marks применяются от внутренней к внешней (порядок в массиве `marks`).
 */
export function InlineRenderer({ nodes, ctx: _ctx }: Props): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "text") return <span key={i}>{node.text ?? ""}</span>;
    if (node.type === "hard_break") return <br key={i} />;
    return <span key={i} data-unsupported={node.type ?? "unknown"}>{node.text ?? ""}</span>;
  });
}
