// src/features/comments/ui/comment-anchor-context.tsx
import { AstRender } from "@/components/ast-render";
import { getT } from "@/i18n";

import { getBlock } from "../api";
import type { Comment } from "../types";

type Anchor = NonNullable<Comment["anchor"]>;

/**
 * Плашка привязки комментария к фрагменту другой сущности. Для text-anchor
 * (document/glossary/comment) резолвим блок через GET /api/blocks/{block_id}
 * и показываем его как контекст. Для media-anchor блока нет — показываем
 * только сухую подпись (UI-плеера в скоупе comments нет).
 */
export async function CommentAnchorContext({ anchor }: { anchor: Anchor }) {
  const t = await getT("comments");

  const entityLabels: Record<string, string> = {
    document: t("anchor.document"),
    glossary: t("anchor.glossary"),
    comment: t("anchor.comment"),
    media: t("anchor.media"),
  };

  const entityLabel = entityLabels[anchor.target_entity_type] ?? anchor.target_entity_type;
  const isText = anchor.target_entity_type !== "media";
  const block = isText && anchor.start_block_id ? await getBlock(anchor.start_block_id) : null;

  return (
    <div className="rounded bg-(--color-surface-subtle) p-2 text-xs">
      <p className="text-(--color-fg-muted)">{t("anchor.boundTo", { entity: entityLabel })}</p>
      {anchor.exact && (
        <blockquote className="mt-1 border-l-2 border-(--color-border) pl-2 italic">
          {anchor.exact}
        </blockquote>
      )}
      {block && (
        <div className="content mt-1 opacity-80" data-size="sm">
          <AstRender blocks={[block]} />
        </div>
      )}
    </div>
  );
}
