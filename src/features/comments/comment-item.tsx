import type { Comment } from "@/api/types";
import { CommentItemActions } from "./comment-item-actions";
import { ReactionButton } from "./reaction-button";

interface CommentItemProps {
  comment: Comment;
  lectureId: string;
  canEdit: boolean;
  canDelete: boolean;
  canReact: boolean;
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
  canReact,
}) => {
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
        <ReactionButton
          commentId={comment.id}
          lectureId={lectureId}
          initialCount={likeCount}
          initialMine={mine}
          disabled={!canReact}
        />
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
