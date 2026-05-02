// src/components/ast-render/block-renderer.tsx
import type { ReactNode } from "react";
import type { AstBlock, AstRenderContext } from "./types";
import { InlineRenderer } from "./inline-renderer";

interface Props {
  block: AstBlock;
  ctx: AstRenderContext;
}

export function BlockRenderer({ block, ctx }: Props): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p><InlineRenderer nodes={block.content} ctx={ctx} /></p>;
    case "heading": {
      const level = readHeadingLevel(block.attrs);
      const Tag = (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
      return <Tag><InlineRenderer nodes={block.content} ctx={ctx} /></Tag>;
    }
    default:
      return (
        <div data-unsupported={block.type ?? "unknown"}>
          <InlineRenderer nodes={block.content} ctx={ctx} />
        </div>
      );
  }
}

function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  const raw = (attrs as { level?: unknown } | undefined)?.level;
  if (typeof raw !== "number") return 2;
  if (raw < 1 || raw > 6) return 2;
  return raw as 1 | 2 | 3 | 4 | 5 | 6;
}
