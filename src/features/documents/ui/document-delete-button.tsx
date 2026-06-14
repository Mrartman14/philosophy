"use client";
// src/features/documents/ui/document-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

import { deleteDocument, adminDeleteDocument } from "../actions";

interface Props {
  id: string;
  /** Куда вернуть после удаления. По умолчанию — мои документы. */
  redirectTo?: string;
  /** true → admin-эндпоинт. По умолчанию — обычный delete. */
  admin?: boolean;
  /** Текст триггера. */
  label?: string;
}

export function DocumentDeleteButton({
  id,
  redirectTo = "/documents/my",
  admin = false,
  label = "Удалить",
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{label}</Button>}
      title="Удалить документ?"
      description="Действие необратимо. Если на документ ссылаются материалы — удаление будет отклонено."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = admin ? await adminDeleteDocument(id) : await deleteDocument(id);
        if (!result.success) {
          if (result.code === "forbidden") {
            toast.add({
              title: "Нет прав",
              description: "У вас нет прав на удаление документа.",
            });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
