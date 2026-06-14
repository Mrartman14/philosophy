"use client";
// src/features/forms/ui/form-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

import { deleteForm } from "../actions";

interface Props {
  id: string;
  redirectTo?: string;
  label?: string;
}

export function FormDeleteButton({ id, redirectTo = "/me/forms", label = "Удалить форму" }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{label}</Button>}
      title="Удалить форму?"
      description="Действие необратимо. Будут удалены все отклики на форму."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteForm(id);
        if (!result.success) {
          toast.add({
            title: result.code === "forbidden" ? "Нет прав" : "Ошибка",
            description: result.code === "forbidden" ? "У вас нет прав на удаление формы." : result.error,
          });
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
