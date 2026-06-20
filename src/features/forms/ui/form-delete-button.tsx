"use client";
// src/features/forms/ui/form-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteForm } from "../actions";

interface Props {
  id: string;
  redirectTo?: string;
  label?: string;
}

export function FormDeleteButton({ id, redirectTo = "/me/forms", label }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("forms");
  const tErrors = useT("errors");
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{label ?? t("deleteFormLabel")}</Button>}
      title={t("deleteFormTitle")}
      description={t("deleteFormDescription")}
      destructive
      confirmLabel={t("deleteConfirm")}
      onConfirm={async () => {
        const result = await deleteForm(id);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: t("deleteFormAction") });
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
