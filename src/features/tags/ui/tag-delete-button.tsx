// src/features/tags/ui/tag-delete-button.tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
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
          toast.add(
            result.code === "forbidden"
              ? { title: "Нет прав", description: "У вас нет прав на удаление тега." }
              : { title: "Ошибка", description: result.error },
          );
          return;
        }
        startTransition(() => router.refresh());
      }}
    />
  );
}
