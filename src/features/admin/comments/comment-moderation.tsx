"use client";

import { useState, useTransition } from "react";
import type { Comment, ModerationStatus } from "@/api/types";
import {
  deleteCommentAdmin,
  updateCommentStatus,
} from "@/features/admin/actions";

interface CommentModerationProps {
  comments: Comment[];
  lectureId: string;
}

const STATUS_BADGE_CLASS: Record<ModerationStatus, string> = {
  published: "text-green-700 bg-green-100",
  pending: "text-amber-700 bg-amber-100",
  hidden: "text-gray-700 bg-gray-100",
};

const STATUS_LABEL: Record<ModerationStatus, string> = {
  published: "Опубликовано",
  pending: "Pending",
  hidden: "Скрыто",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}

export const CommentModeration: React.FC<CommentModerationProps> = ({
  comments,
  lectureId,
}) => {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">
        Комментариев нет.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {comments.map((comment) => (
        <li key={comment.id}>
          <CommentModerationItem comment={comment} lectureId={lectureId} />
        </li>
      ))}
    </ul>
  );
};

interface ItemProps {
  comment: Comment;
  lectureId: string;
}

const CommentModerationItem: React.FC<ItemProps> = ({
  comment,
  lectureId,
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const handleStatus = (status: ModerationStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await updateCommentStatus({
        commentId: comment.id,
        status,
        lectureId,
      });
      if (!result.success) setError(result.error);
    });
  };

  const handleDelete = () => {
    if (!confirm("Удалить комментарий?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCommentAdmin({
        commentId: comment.id,
        lectureId,
      });
      if (result.success) setDeleted(true);
      else setError(result.error);
    });
  };

  if (deleted) {
    return (
      <article className="p-3 border border-(--color-border) rounded opacity-50">
        <p className="text-xs text-(--color-description)">Удалено</p>
      </article>
    );
  }

  const authorLabel = comment.is_anonymous
    ? "Аноним"
    : comment.author?.username ?? "Аноним";

  const currentStatus = comment.status;

  const statusButtonClass = (status: ModerationStatus) =>
    [
      "px-2 py-1 text-xs border border-(--color-border) rounded disabled:opacity-50",
      currentStatus === status
        ? "bg-(--color-primary)/10 font-semibold"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <article className="p-3 border border-(--color-border) rounded flex flex-col gap-2">
      <header className="flex flex-wrap items-baseline gap-2 text-xs">
        <span className="font-semibold text-sm">{authorLabel}</span>
        <time className="text-(--color-description)">
          {formatDate(comment.created_at)}
        </time>
        {comment.is_edited && (
          <span className="text-(--color-description)">(изменено)</span>
        )}
        <span
          className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE_CLASS[currentStatus]}`}
        >
          {STATUS_LABEL[currentStatus]}
        </span>
      </header>
      <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleStatus("published")}
          disabled={pending}
          aria-pressed={currentStatus === "published"}
          className={statusButtonClass("published")}
        >
          Опубликовать
        </button>
        <button
          type="button"
          onClick={() => handleStatus("hidden")}
          disabled={pending}
          aria-pressed={currentStatus === "hidden"}
          className={statusButtonClass("hidden")}
        >
          Скрыть
        </button>
        <button
          type="button"
          onClick={() => handleStatus("pending")}
          disabled={pending}
          aria-pressed={currentStatus === "pending"}
          className={statusButtonClass("pending")}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="px-2 py-1 text-xs border border-red-500 text-red-500 rounded disabled:opacity-50"
        >
          Удалить
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </article>
  );
};
