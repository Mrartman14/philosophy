"use client";
// src/features/forms/ui/submission-actions.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

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
  const t = useT("forms");
  const [, startTransition] = useTransition();

  const isDelete = kind === "delete";

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{isDelete ? t("deleteSubmissionButton") : t("retractSubmissionButton")}</Button>}
      title={isDelete ? t("deleteSubmissionTitle") : t("retractSubmissionTitle")}
      description={
        isDelete
          ? t("deleteSubmissionDescription")
          : t("retractSubmissionDescription")
      }
      destructive
      confirmLabel={isDelete ? t("deleteSubmissionConfirm") : t("retractSubmissionConfirm")}
      onConfirm={async () => {
        const result = isDelete
          ? await deleteSubmission(submissionId)
          : await retractSubmission(submissionId);
        if (!result.success) {
          toastActionError(toast, result, { action: `${isDelete ? "удаление" : "отзыв"} отклика` });
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
