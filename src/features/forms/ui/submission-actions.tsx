"use client";
// src/features/forms/ui/submission-actions.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

import { deleteSubmission, retractSubmission } from "../actions";

interface Props {
  submissionId: string;
  /** "delete" — editable-формы (освобождает слот); "retract" — immutable (сжигает слот). */
  kind: "delete" | "retract";
  redirectTo?: string;
}

export function SubmissionActions({ submissionId, kind, redirectTo = "/me/submissions" }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const isDelete = kind === "delete";

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{isDelete ? "Удалить отклик" : "Отозвать отклик"}</Button>}
      title={isDelete ? "Удалить отклик?" : "Отозвать отклик?"}
      description={
        isDelete
          ? "Отклик будет удалён. Вы сможете заполнить форму заново."
          : "Отзыв необратим: повторно отправить отклик на эту форму будет нельзя."
      }
      destructive
      confirmLabel={isDelete ? "Удалить" : "Отозвать"}
      onConfirm={async () => {
        const result = isDelete
          ? await deleteSubmission(submissionId)
          : await retractSubmission(submissionId);
        if (!result.success) {
          toast.add({
            title: result.code === "forbidden" ? "Нет прав" : "Ошибка",
            description:
              result.code === "forbidden"
                ? `У вас нет прав на ${isDelete ? "удаление" : "отзыв"} отклика.`
                : result.error,
          });
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
