"use client";
// src/features/banners/ui/banner-delete-button.tsx
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteBanner } from "../actions";

interface Props {
  id: string;
}

export function BannerDeleteButton({ id }: Props) {
  const t = useT("banners");
  const tErrors = useT("errors");
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  return (
    <ConfirmDialog
      trigger={<Button tone="danger">{t("deleteButton")}</Button>}
      title={t("deleteTitle")}
      description={t("deleteDescription")}
      destructive
      confirmLabel={t("deleteButton")}
      onConfirm={async () => {
        const result = await deleteBanner(id, key);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: t("deleteAction") });
          return;
        }
        // С edit-страницы — на список; из списка — refresh.
        if (pathname.startsWith(`/admin/banners/${id}`)) {
          startTransition(() => { router.push("/admin/banners"); });
        } else {
          startTransition(() => { router.refresh(); });
        }
      }}
    />
  );
}
