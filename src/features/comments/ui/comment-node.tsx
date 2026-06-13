// src/features/comments/ui/comment-node.tsx
import { AstRender } from "@/components/ast-render";
import { getMe } from "@/utils/me";
import { type AstBlock } from "@/components/ast-editor";
import {
  canDeleteComment,
  canEditComment,
  canReactToComment,
} from "../permissions";
import { axisAllowedForType } from "../reactions";
import { CommentTypeBadge } from "./comment-type-badge";
import { CommentReactions } from "./comment-reactions";
import { CommentReplyForm } from "./comment-reply-form";
import { CommentEditForm } from "./comment-edit-form";
import { CommentDeleteButton } from "./comment-delete-button";
import { CommentAnchorContext } from "./comment-anchor-context";
import type { Comment, CommentSchema, CommentType, ReactionAxis } from "../types";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

interface Props {
  comment: Comment;
  lectureId: string;
  schema: CommentSchema;
}

export async function CommentNode({ comment, lectureId, schema }: Props) {
  const me = await getMe();

  if (comment.is_deleted) {
    return (
      <div className="rounded border border-dashed border-(--color-border) p-3 text-sm text-(--color-description)">
        Комментарий удалён
      </div>
    );
  }

  const type = comment.type as CommentType;
  const allowedAxes = (schema.allowed_reactions?.[type] ?? []).filter((a): a is ReactionAxis =>
    axisAllowedForType(schema, type, a as ReactionAxis),
  );
  const childTypes = (schema.allowed_children?.[type] ?? []) as CommentType[];

  return (
    <div className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-description)">
        <CommentTypeBadge type={type} />
        <span>{comment.author?.username ?? "—"}</span>
        <span>{formatDate(comment.created_at)}</span>
        {comment.is_edited && <span>(изменён)</span>}
      </div>

      {comment.anchor && (
        <CommentAnchorContext anchor={comment.anchor} />
      )}

      <div className="prose prose-sm max-w-none">
        <AstRender blocks={(comment.blocks ?? []) as AstBlock[]} />
      </div>

      <CommentReactions
        commentId={comment.id}
        type={type}
        reactions={comment.reactions}
        myReactions={comment.my_reactions}
        allowedAxes={allowedAxes}
        canReact={canReactToComment(me, comment)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {canEditComment(me, comment) && (
          <CommentEditForm
            commentId={comment.id}
            lectureId={lectureId}
            initialBlocks={(comment.blocks ?? []) as AstBlock[]}
          />
        )}
        {canDeleteComment(me, comment) && (
          <CommentDeleteButton
            commentId={comment.id}
            admin={comment.user_id !== me?.id}
          />
        )}
        {me && (
          <CommentReplyForm lectureId={lectureId} parentId={comment.id} childTypes={childTypes} />
        )}
      </div>
    </div>
  );
}
