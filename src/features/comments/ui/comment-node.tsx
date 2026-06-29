// src/features/comments/ui/comment-node.tsx
import { getLocale, getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { getServerTz } from "@/utils/timezone-server";

import {
  canDeleteComment,
  canEditComment,
  canReactToComment,
} from "../permissions";
import { axisAllowedForType } from "../reactions";
import type { Comment, CommentSchema, ReactionAxis } from "../types";

import { CommentAnchorContext } from "./comment-anchor-context";
import { CommentDeleteButton } from "./comment-delete-button";
import { CommentEditForm } from "./comment-edit-form";
import { CommentNodeView } from "./comment-node-view";
import { CommentReactions } from "./comment-reactions";
import { CommentReplyForm } from "./comment-reply-form";

interface Props {
  comment: Comment;
  lectureId: string;
  schema: CommentSchema;
}

export async function CommentNode({ comment, lectureId, schema }: Props) {
  const [me, t, locale, tz] = await Promise.all([
    getMe(),
    getT("comments"),
    getLocale(),
    getServerTz(),
  ]);

  if (comment.is_deleted) {
    return <CommentNodeView comment={comment} deletedLabel={t("deleted")} />;
  }

  const type = comment.type;
  const allowedAxes = (schema.allowed_reactions?.[type] ?? []).filter(
    (a): a is ReactionAxis => axisAllowedForType(schema, type, a),
  );
  const childTypes = schema.allowed_children?.[type] ?? [];

  return (
    <CommentNodeView
      comment={comment}
      deletedLabel={t("deleted")}
      editedLabel={t("edited")}
      typeLabel={t(`type.${type}`)}
      locale={locale}
      tz={tz}
      anchorSlot={
        comment.anchor ? <CommentAnchorContext anchor={comment.anchor} /> : undefined
      }
      reactionsSlot={
        <CommentReactions
          commentId={comment.id}
          type={type}
          reactions={comment.reactions}
          myReactions={comment.my_reactions}
          allowedAxes={allowedAxes}
          canReact={canReactToComment(me, comment)}
        />
      }
      actionsSlot={
        <div className="flex flex-wrap items-center gap-2">
          {canEditComment(me, comment) && (
            <CommentEditForm
              commentId={comment.id}
              lectureId={lectureId}
              initialBlocks={comment.blocks ?? []}
              version={comment.version}
            />
          )}
          {canDeleteComment(me, comment) && (
            <CommentDeleteButton
              commentId={comment.id}
              admin={comment.author?.id !== me?.id}
            />
          )}
          {me && (
            <CommentReplyForm
              lectureId={lectureId}
              parentId={comment.id}
              childTypes={childTypes}
            />
          )}
        </div>
      }
    />
  );
}
