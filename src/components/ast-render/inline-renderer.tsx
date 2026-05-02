// src/components/ast-render/inline-renderer.tsx
import type { ReactNode } from "react";
import type { AstMark, AstNode, AstRenderContext } from "./types";
import { LinkMark } from "./marks/link";

interface Props {
  nodes: AstNode[] | undefined;
  ctx: AstRenderContext;
}

export function InlineRenderer({ nodes, ctx }: Props): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hard_break") return <br key={i} />;
    if (node.type === "text") {
      return <TextWithMarks key={i} text={node.text ?? ""} marks={node.marks} ctx={ctx} />;
    }
    return <span key={i} data-unsupported={node.type ?? "unknown"}>{node.text ?? ""}</span>;
  });
}

interface TextWithMarksProps {
  text: string;
  marks: AstMark[] | undefined;
  ctx: AstRenderContext;
}

function TextWithMarks({ text, marks, ctx: _ctx }: TextWithMarksProps): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((children, mark) => applyMark(mark, children), text);
}

function applyMark(mark: AstMark, children: ReactNode): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "code":
      return <code>{children}</code>;
    case "link": {
      const href = (mark.attrs as { href?: unknown } | undefined)?.href;
      return <LinkMark href={typeof href === "string" ? href : undefined}>{children}</LinkMark>;
    }
    default:
      return <span data-unsupported-mark={mark.type ?? "unknown"}>{children}</span>;
  }
}
