// src/components/ast-render/ast-render.tsx
import type { ReactNode } from "react";
import { BlockRenderer } from "./block-renderer";
import type { AstRenderProps, AstRenderContext } from "./types";

export function AstRender({ blocks, ctx }: AstRenderProps): ReactNode {
  const effectiveCtx: AstRenderContext = ctx ?? {};
  return (
    <div className="ast-render">
      {blocks.map((block, i) => (
        <BlockRenderer key={block.id ?? i} block={block} ctx={effectiveCtx} />
      ))}
    </div>
  );
}
