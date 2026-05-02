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
    default:
      return (
        <div data-unsupported={block.type ?? "unknown"}>
          <InlineRenderer nodes={block.content} ctx={ctx} />
        </div>
      );
  }
}
