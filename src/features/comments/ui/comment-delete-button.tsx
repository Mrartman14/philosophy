"use client";
// src/features/comments/ui/comment-delete-button.tsx
import { useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { toastActionError } from "@/utils/action-toast";

import { deleteComment, adminDeleteComment } from "../actions";

interface Props {
  commentId: string;
  /** true → admin-роут (comment.delete_any), false → owner-роут. */
  admin?: boolean;
}

export function CommentDeleteButton({ commentId, admin = false }: Props) {
  const [done, setDone] = useState(false);
  const toast = useToast();
  const { key } = useIdempotencyKey();
  if (done) return <span className="text-xs text-(--color-fg-muted)">Удалено</span>;
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="danger" className="text-xs">
          Удалить
        </Button>
      }
      title="Удалить комментарий?"
      description="Действие необратимо. Если у комментария есть ответы, он станет «удалён», но ветка сохранится."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = admin
          ? await adminDeleteComment(commentId)
          : await deleteComment(commentId, key);
        if (result.success) {
          setDone(true);
        } else {
          toastActionError(toast, result, {
            action: "удаление комментария",
            forbiddenTitle: "Не удалось удалить",
            failureTitle: "Не удалось удалить",
          });
        }
      }}
    />
  );
}
