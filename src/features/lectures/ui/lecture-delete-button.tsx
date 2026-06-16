"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { deleteLecture } from "../actions";

interface Props {
  lectureId: string;
  redirectTo?: string;
}

export function LectureDeleteButton({ lectureId, redirectTo }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить лекцию?"
      description="Действие необратимо."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteLecture(lectureId);
        if (!result.success) {
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
