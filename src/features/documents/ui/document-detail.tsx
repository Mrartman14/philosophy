// src/features/documents/ui/document-detail.tsx
import { AstRender } from "@/components/ast-render";

import type { Document } from "../types";

interface Props {
  document: Document;
}

export function DocumentDetail({ document }: Props) {
  const blocks = document.blocks ?? [];
  return (
    <article className="content">
      {blocks.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">Документ пуст.</p>
      ) : (
        <AstRender blocks={blocks} />
      )}
    </article>
  );
}
