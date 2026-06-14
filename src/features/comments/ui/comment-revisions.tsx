// src/features/comments/ui/comment-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getCommentRevision, getCommentRevisions } from "../api";

interface Props {
  commentId: string;
  selectedRevisionId?: string | undefined;
  /** Базовый путь для ?revision= (например `/comments/${id}`). */
  basePath: string;
}

export async function CommentRevisions({ commentId, selectedRevisionId, basePath }: Props) {
  const metas = await getCommentRevisions(commentId);
  const selected = selectedRevisionId
    ? await getCommentRevision(commentId, selectedRevisionId)
    : null;

  return (
    <RevisionHistory
      // Бек отдаёт ASC (старые первыми) — переворачиваем, новые сверху.
      revisions={[...metas]
        .reverse()
        .flatMap((m) => (m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : []))}
      selectedId={selected?.id}
      buildHref={(rid) => `${basePath}?revision=${rid}`}
    >
      {selected && (
        <div className="prose prose-sm max-w-none">
          <AstRender blocks={(selected.blocks ?? [])} />
        </div>
      )}
    </RevisionHistory>
  );
}
