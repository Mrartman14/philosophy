"use client";

import { useState, useTransition } from "react";
import { deleteComment } from "./actions";
import { CommentForm } from "./comment-form";

interface CommentItemActionsProps {
  commentId: string;
  lectureId: string;
  initialBody: string;
  canEdit: boolean;
  canDelete: boolean;
}

export const CommentItemActions: React.FC<CommentItemActionsProps> = ({
  commentId,
  lectureId,
  initialBody,
  canEdit,
  canDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (!confirm("Удалить комментарий?")) return;
    startTransition(async () => {
      setError(null);
      const result = await deleteComment({ commentId, lectureId });
      if (!result.success) {
        setError(result.error);
      }
    });
  };

  if (isEditing) {
    return (
      <div className="mt-2">
        <CommentForm
          lectureId={lectureId}
          allowAnonymous={false}
          editing={{
            commentId,
            initialBody,
            onCancel: () => setIsEditing(false),
          }}
        />
      </div>
    );
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex items-center gap-2 mt-1">
      {canEdit && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs text-(--color-description) hover:text-(--color-link) transition-colors"
        >
          Редактировать
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs text-(--color-description) hover:text-red-500 transition-colors disabled:opacity-50"
        >
          {isPending ? "Удаление..." : "Удалить"}
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
};
