"use client";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteTerm } from "../actions";

interface Props {
  id: string;
}

export function GlossaryDeleteButton({ id }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const t = useT("glossary");
  const tErrors = useT("errors");
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  return (
    <ConfirmDialog
      trigger={<Button tone="danger">{t("deleteButton")}</Button>}
      title={t("deleteConfirmTitle")}
      description={t("deleteConfirmDescription")}
      destructive
      confirmLabel={t("deleteConfirmLabel")}
      onConfirm={async () => {
        const result = await deleteTerm(id, key);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: t("deleteTermAction") });
          return;
        }
        // Если мы на edit-странице термина — редирект на список; иначе refresh.
        if (pathname.startsWith(`/admin/glossary/${id}`)) {
          startTransition(() => { router.push("/admin/glossary"); });
        } else {
          startTransition(() => { router.refresh(); });
        }
      }}
    />
  );
}
