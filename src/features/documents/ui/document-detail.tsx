// src/features/documents/ui/document-detail.tsx
import { AstRender } from "@/components/ast-render";
import { getT } from "@/i18n";

import type { Document } from "../types";

interface Props {
  document: Document;
}

export async function DocumentDetail({ document }: Props) {
  const t = await getT("documents");
  const blocks = document.blocks ?? [];
  return (
    <article className="content">
      {blocks.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("emptyDocument")}</p>
      ) : (
        <AstRender blocks={blocks} />
      )}
    </article>
  );
}
