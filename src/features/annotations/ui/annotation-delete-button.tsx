"use client";
// src/features/annotations/ui/annotation-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { TrashIcon } from "@/assets/icons/trash-icon";
import { Button, ConfirmDialog, IconButton, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteAnnotation, adminDeleteAnnotation } from "../actions";

interface Props {
  annotationId: string;
  /** true → admin-удаление (DELETE /api/admin/annotations/{id}); иначе own. */
  admin?: boolean;
  /** true → иконочная кнопка (корзина) вместо текстовой (для маргиналии). */
  icon?: boolean;
}

/**
 * Кнопка удаления. ConfirmDialog не surface'ит ошибки onConfirm — ловим сами
 * (conventions §3.4) и показываем тостом. forbidden → branded-текст.
 * После успеха — router.refresh() (списки/секции перечитываются на сервере).
 */
export function AnnotationDeleteButton({ annotationId, admin = false, icon = false }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("annotations");
  const tErrors = useT("errors");
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  const trigger = icon ? (
    <IconButton type="button" compact tone="danger" aria-label={t("deleteButton")} title={t("deleteButton")}>
      <TrashIcon className="text-base" />
    </IconButton>
  ) : (
    <Button tone="danger">{t("deleteButton")}</Button>
  );

  return (
    <ConfirmDialog
      trigger={trigger}
      title={t("deleteDialogTitle")}
      description={t("deleteDialogDescription")}
      destructive
      confirmLabel={t("deleteDialogConfirm")}
      onConfirm={async () => {
        const result = admin
          ? await adminDeleteAnnotation(annotationId)
          : await deleteAnnotation(annotationId, key);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: t("deleteAction") });
          return;
        }
        startTransition(() => { router.refresh(); });
      }}
    />
  );
}
