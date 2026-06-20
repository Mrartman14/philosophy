"use client";
// src/features/comments/ui/comment-delete-button.tsx
import { useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteComment, adminDeleteComment } from "../actions";

interface Props {
  commentId: string;
  /** true → admin-роут (comment.delete_any), false → owner-роут. */
  admin?: boolean;
}

export function CommentDeleteButton({ commentId, admin = false }: Props) {
  const t = useT("comments");
  const tErrors = useT("errors");
  const [done, setDone] = useState(false);
  const toast = useToast();
  const { key } = useIdempotencyKey();
  if (done) return <span className="text-xs text-(--color-fg-muted)">{t("deleteDone")}</span>;
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="danger" className="text-xs">
          {t("deleteButton")}
        </Button>
      }
      title={t("deleteDialogTitle")}
      description={t("deleteDialogDescription")}
      destructive
      confirmLabel={t("deleteDialogConfirm")}
      onConfirm={async () => {
        const result = admin
          ? await adminDeleteComment(commentId)
          : await deleteComment(commentId, key);
        if (result.success) {
          setDone(true);
        } else {
          toastActionError(toast, tErrors, result, {
            action: t("deleteAction"),
            forbiddenTitle: t("deleteForbiddenTitle"),
            failureTitle: t("deleteFailureTitle"),
          });
        }
      }}
    />
  );
}
