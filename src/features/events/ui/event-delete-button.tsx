"use client";
// src/features/events/ui/event-delete-button.tsx
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteEvent } from "../actions";

interface Props {
  id: string;
}

export function EventDeleteButton({ id }: Props) {
  const t = useT("events");
  const tErrors = useT("errors");
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{t("btnDelete")}</Button>}
      title={t("deleteDialogTitle")}
      description={t("deleteDialogDescription")}
      destructive
      confirmLabel={t("deleteConfirmLabel")}
      onConfirm={async () => {
        const result = await deleteEvent(id, key);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: t("deleteAction") });
          return;
        }
        // С edit-страницы — на список; из списка — refresh.
        if (pathname.startsWith(`/admin/events/${id}`)) {
          startTransition(() => { router.push("/admin/events"); });
        } else {
          startTransition(() => { router.refresh(); });
        }
      }}
    />
  );
}
