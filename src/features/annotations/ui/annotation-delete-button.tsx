"use client";
// src/features/annotations/ui/annotation-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";

import { deleteAnnotation, adminDeleteAnnotation } from "../actions";

interface Props {
  annotationId: string;
  /** true → admin-удаление (DELETE /api/admin/annotations/{id}); иначе own. */
  admin?: boolean;
}

/**
 * Кнопка удаления. ConfirmDialog не surface'ит ошибки onConfirm — ловим сами
 * (conventions §3.4) и показываем тостом. forbidden → branded-текст.
 * После успеха — router.refresh() (списки/секции перечитываются на сервере).
 */
export function AnnotationDeleteButton({ annotationId, admin = false }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить аннотацию?"
      description="Действие необратимо."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = admin
          ? await adminDeleteAnnotation(annotationId)
          : await deleteAnnotation(annotationId, key);
        if (!result.success) {
          toast.add(
            result.code === "forbidden"
              ? {
                  title: "Нет прав",
                  description: "У вас нет прав на удаление аннотации.",
                }
              : { title: "Ошибка", description: result.error },
          );
          return;
        }
        startTransition(() => { router.refresh(); });
      }}
    />
  );
}
