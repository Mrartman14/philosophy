"use client";
// src/features/media/ui/media-delete-button.tsx
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { deleteMedia } from "../actions";

interface Props {
  id: string;
  /** true — текущий пользователь админ (для текста подтверждения). */
  isAdminDelete?: boolean;
}

export function MediaDeleteButton({ id, isAdminDelete = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить медиа?"
      description={
        isAdminDelete
          ? "Удаление администратором. Действие необратимо: файл будет удалён, ссылки на него перестанут работать."
          : "Действие необратимо. Файл будет удалён, ссылки на него перестанут работать."
      }
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteMedia(id);
        if (!result.success) {
          toastActionError(toast, result, { action: "удаление медиа" });
          return;
        }
        if (pathname === `/media/${id}`) {
          startTransition(() => { router.push("/media/my"); });
        } else {
          startTransition(() => { router.refresh(); });
        }
      }}
    />
  );
}
