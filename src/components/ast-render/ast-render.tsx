// src/components/ast-render/ast-render.tsx
import type { ReactNode } from "react";

import { BlockRenderer } from "./block-renderer";
import type { AstRenderProps } from "./types";

export function AstRender({ blocks }: AstRenderProps): ReactNode {
  // Без обёртки: блоки — прямые дети контейнера консьюмера (`.content`). Любой
  // промежуточный элемент рвёт flow-селекторы content.css (`.content > * + *`
  // и пр.) и убивает вертикальный ритм. См. flow-контракт в ast-render.test.tsx.
  return (
    <>
      {blocks.map((block, i) => (
        <BlockRenderer key={block.id ?? i} block={block} />
      ))}
    </>
  );
}
