// src/features/comments/ui/comment-anchor-context.tsx
import { AstRender } from "@/components/ast-render";
import { type AstBlock } from "@/components/ast-editor";
import { getBlock } from "../api";
import type { Comment } from "../types";

type Anchor = NonNullable<Comment["anchor"]>;

const ENTITY_LABELS: Record<string, string> = {
  document: "документу",
  glossary: "термину",
  comment: "комментарию",
  media: "медиа",
};

/**
 * Плашка привязки комментария к фрагменту другой сущности. Для text-anchor
 * (document/glossary/comment) резолвим блок через GET /api/blocks/{block_id}
 * и показываем его как контекст. Для media-anchor блока нет — показываем
 * только сухую подпись (UI-плеера в скоупе comments нет).
 */
export async function CommentAnchorContext({ anchor }: { anchor: Anchor }) {
  const entityLabel = ENTITY_LABELS[anchor.target_entity_type] ?? anchor.target_entity_type;
  const isText = anchor.target_entity_type !== "media";
  const block = isText && anchor.start_block_id ? await getBlock(anchor.start_block_id) : null;

  return (
    <div className="rounded bg-(--color-text-pane) p-2 text-xs">
      <p className="text-(--color-description)">Привязка к {entityLabel}</p>
      {anchor.exact && (
        <blockquote className="mt-1 border-l-2 border-(--color-border) pl-2 italic">
          {anchor.exact}
        </blockquote>
      )}
      {block && (
        <div className="prose prose-sm mt-1 max-w-none opacity-80">
          <AstRender blocks={[block as AstBlock]} />
        </div>
      )}
    </div>
  );
}
