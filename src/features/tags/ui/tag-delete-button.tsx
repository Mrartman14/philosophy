// src/features/tags/ui/tag-delete-button.tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { deleteTag } from "../actions";

interface Props {
  id: number;
  name: string;
}

export function TagDeleteButton({ id, name }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title={`Удалить тег «${name}»?`}
      description="Тег будет снят со всех лекций. Действие необратимо."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteTag(id);
        if (!result.success) {
          toastActionError(toast, result, { action: "удаление тега" });
          return;
        }
        startTransition(() => { router.refresh(); });
      }}
    />
  );
}
