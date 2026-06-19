// src/features/comments/ui/admin-comment-row.tsx
import { AstRender } from "@/components/ast-render";

import { formatCommentDate } from "../comment-format";
import type { Comment } from "../types";

import { CommentDeleteButton } from "./comment-delete-button";
import { CommentTypeBadge } from "./comment-type-badge";

export function AdminCommentRow({ comment }: { comment: Comment }) {
  const deleted = comment.is_deleted;
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-(--color-border) p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-(--color-description)">
          <CommentTypeBadge type={comment.type} />
          <span>{comment.author?.username ?? "—"}</span>
          <span>{formatCommentDate(comment.created_at)}</span>
          {deleted && <span className="text-red-600">удалён</span>}
        </div>
        {!deleted && (
          <div className="content" data-size="sm">
            <AstRender blocks={(comment.blocks ?? [])} />
          </div>
        )}
      </div>
      {!deleted && <CommentDeleteButton commentId={comment.id} admin />}
    </div>
  );
}
