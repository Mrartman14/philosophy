"use client";
// src/features/documents/ui/document-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

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
  redirectTo = "/me/documents",
  admin = false,
  label,
}: Props) {
  const t = useT("documents");
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{label ?? t("deleteButton")}</Button>}
      title={t("deleteDialogTitle")}
      description={t("deleteDialogDescription")}
      destructive
      confirmLabel={t("deleteDialogConfirm")}
      onConfirm={async () => {
        const result = admin ? await adminDeleteDocument(id, key) : await deleteDocument(id, key);
        if (!result.success) {
          // toastActionError is a frozen seam (action-toast.ts); the action string
          // is a legacy plain-Russian prop until that seam gets its i18n foundation-PR.
          toastActionError(toast, result, { action: "удаление документа" });
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
