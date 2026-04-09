import type { Comment } from "@/api/types";
import type { DenyReason } from "@/utils/permissions";
import { ActionTooltip } from "@/components/permission/action-tooltip";
import { CommentItemActions } from "./comment-item-actions";
import { ReactionButton } from "./reaction-button";

interface CommentItemProps {
  comment: Comment;
  lectureId: string;
  canEdit: boolean;
  canDelete: boolean;
  reactionDeny: DenyReason | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getAuthorLabel(comment: Comment): string {
  if (comment.is_anonymous) return "Аноним";
  return comment.author?.username ?? "Аноним";
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  lectureId,
  canEdit,
  canDelete,
  reactionDeny,
}) => {
  const canReact = reactionDeny === null;
  const likeCount = comment.reactions?.like ?? 0;
  const mine = comment.my_reaction === "like";

  return (
    <article className="p-3 border border-(--color-border) rounded-lg">
      <header className="flex items-baseline gap-2 mb-1">
        <span className="text-sm font-semibold">{getAuthorLabel(comment)}</span>
        <time className="text-xs text-(--color-description)">
          {formatDate(comment.created_at)}
        </time>
        {comment.is_edited && (
          <span className="text-xs text-(--color-description)">(изменено)</span>
        )}
      </header>

      <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>

      <footer className="flex items-center gap-3 mt-2">
        {/*
          ActionTooltip оборачивает в <span title=...>; за реальный disabled-вид
          отвечает ReactionButton через свой проп `disabled={!canReact}`.
        */}
        <ActionTooltip reason={reactionDeny} action="поставить лайк">
          <ReactionButton
            commentId={comment.id}
            lectureId={lectureId}
            initialCount={likeCount}
            initialMine={mine}
            disabled={!canReact}
          />
        </ActionTooltip>
      </footer>

      <CommentItemActions
        commentId={comment.id}
        lectureId={lectureId}
        initialBody={comment.body}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </article>
  );
};
