"use client";
// src/features/media/ui/media-delete-button.tsx
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
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
  const t = useT("media");
  const tErrors = useT("errors");

  return (
    <ConfirmDialog
      trigger={<Button tone="danger">{t("deleteButton")}</Button>}
      title={t("deleteTitle")}
      description={
        isAdminDelete
          ? t("deleteDescriptionAdmin")
          : t("deleteDescription")
      }
      destructive
      confirmLabel={t("deleteButton")}
      onConfirm={async () => {
        const result = await deleteMedia(id);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: t("deleteAction") });
          return;
        }
        if (pathname === `/media/${id}`) {
          startTransition(() => { router.push("/me/media"); });
        } else {
          startTransition(() => { router.refresh(); });
        }
      }}
    />
  );
}
