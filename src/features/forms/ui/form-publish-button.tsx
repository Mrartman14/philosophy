"use client";
// src/features/forms/ui/form-publish-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { publishForm } from "../actions";

interface Props {
  formId: string;
}

export function FormPublishButton({ formId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="primary">Опубликовать</Button>}
      title="Опубликовать форму?"
      description="После публикации форму нельзя вернуть в приватную, а её структуру — изменить. Действующие share-ссылки перестанут работать."
      confirmLabel="Опубликовать"
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("id", formId);
        fd.set("visibility", "public");
        const result = await publishForm({ success: true, data: null }, fd);
        if (!result.success) {
          toast.add({
            title: result.code === "forbidden" ? "Нет прав" : "Ошибка",
            description: result.code === "forbidden" ? "У вас нет прав на публикацию формы." : result.error,
          });
          return;
        }
        startTransition(() => router.refresh());
      }}
    />
  );
}
