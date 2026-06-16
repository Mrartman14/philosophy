"use client";
// src/features/trails/ui/trail-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
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
  label = "Удалить",
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{label}</Button>}
      title="Удалить маршрут?"
      description="Действие необратимо. Лекции в маршруте удалены не будут — только сам маршрут."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = admin ? await adminDeleteTrail(id) : await deleteTrail(id);
        if (!result.success) {
          toastActionError(toast, result, { action: "удаление маршрута" });
          return;
        }
        startTransition(() => { router.push(redirectTo); });
      }}
    />
  );
}
