"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

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
          if (result.code === "forbidden") {
            toast.add({ title: "Нет прав", description: "У вас нет прав на удаление лекции." });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
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
