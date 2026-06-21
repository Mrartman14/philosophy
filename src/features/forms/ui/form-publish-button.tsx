"use client";
// src/features/forms/ui/form-publish-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { publishForm } from "../actions";

interface Props {
  formId: string;
}

export function FormPublishButton({ formId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("forms");
  const tErrors = useT("errors");
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button tone="primary">{t("publishButton")}</Button>}
      title={t("publishTitle")}
      description={t("publishDescription")}
      confirmLabel={t("publishConfirm")}
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("id", formId);
        fd.set("visibility", "public");
        const result = await publishForm({ success: true, data: null }, fd);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: t("publishAction") });
          return;
        }
        startTransition(() => { router.refresh(); });
      }}
    />
  );
}
