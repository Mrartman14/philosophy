"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteLecture } from "../actions";

interface Props {
  lectureId: string;
  redirectTo?: string;
}

export function LectureDeleteButton({ lectureId, redirectTo }: Props) {
  const tL = useT("lectures");
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{tL("deleteButton")}</Button>}
      title={tL("deleteDialogTitle")}
      description={tL("deleteDialogDescription")}
      destructive
      confirmLabel={tL("deleteButton")}
      onConfirm={async () => {
        const result = await deleteLecture(lectureId);
        if (!result.success) {
          // toastActionError is a frozen seam (action-toast.ts); the action string
          // is a legacy plain-Russian prop until that seam gets its i18n foundation-PR.
          toastActionError(toast, result, { action: "удаление лекции" });
          return;
        }
        if (redirectTo) {
          startTransition(() => { router.push(redirectTo); });
        } else {
          startTransition(() => { router.refresh(); });
        }
      }}
    />
  );
}
