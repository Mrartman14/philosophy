// src/features/comments/ui/admin-comment-row.tsx
import { AstRender } from "@/components/ast-render";
import { type AstBlock } from "@/components/ast-editor";
import { CommentTypeBadge } from "./comment-type-badge";
import { CommentDeleteButton } from "./comment-delete-button";
import type { Comment } from "../types";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

export function AdminCommentRow({ comment }: { comment: Comment }) {
  const deleted = comment.is_deleted;
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-(--color-border) p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-(--color-description)">
          <CommentTypeBadge type={comment.type} />
          <span>{comment.author?.username ?? "—"}</span>
          <span>{comment.created_at ? dateFmt.format(new Date(comment.created_at)) : ""}</span>
          {deleted && <span className="text-red-600">удалён</span>}
        </div>
        {!deleted && (
          <div className="prose prose-sm max-w-none">
            <AstRender blocks={(comment.blocks ?? []) as AstBlock[]} />
          </div>
        )}
      </div>
      {!deleted && <CommentDeleteButton commentId={comment.id} admin />}
    </div>
  );
}
