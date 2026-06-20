"use client";
// src/features/trails/ui/trail-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteTrail, adminDeleteTrail } from "../actions";

interface Props {
  id: string;
  /** Куда вернуть после удаления. По умолчанию — мои маршруты. */
  redirectTo?: string;
  /** true → admin-удаление (тот же DELETE, гейт delete_any). */
  admin?: boolean;
  /** Текст триггера. */
  label?: string;
}

export function TrailDeleteButton({
  id,
  redirectTo = "/trails/my",
  admin = false,
  label,
}: Props) {
  const router = useRouter();
  const t = useT("trails");
  const tErrors = useT("errors");
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{label ?? t("deleteLabel")}</Button>}
      title={t("deleteDialogTitle")}
      description={t("deleteDialogDescription")}
      destructive
      confirmLabel={t("deleteDialogConfirm")}
      onConfirm={async () => {
        const result = admin ? await adminDeleteTrail(id) : await deleteTrail(id);
        if (!result.success) {
          toastActionError(toast, tErrors, result, {
            action: t("deleteAction"),
            forbiddenTitle: t("deleteForbiddenTitle"),
            failureTitle: t("deleteFailureTitle"),
          });
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
