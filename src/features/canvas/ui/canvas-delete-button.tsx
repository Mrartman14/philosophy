"use client";
// src/features/canvas/ui/canvas-delete-button.tsx
import { useRouter } from "next/navigation";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";

import { deleteCanvas } from "../actions";

interface Props {
  id: string;
}

/** Удаление канваса с подтверждением. После успеха → редирект на /canvases. */
export function CanvasDeleteButton({ id }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("canvas");
  const tErrors = useT("errors");

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{t("deleteButton.trigger")}</Button>}
      title={t("deleteButton.title")}
      description={t("deleteButton.description")}
      destructive
      confirmLabel={t("deleteButton.confirmLabel")}
      onConfirm={async () => {
        const result = await deleteCanvas(id);
        if (result.success) {
          toast.add({ title: t("deleteButton.toastDeletedTitle") });
          router.push("/canvases");
        } else if (result.code === "forbidden") {
          toast.add({
            title: tErrors("forbiddenTitle"),
            description: tErrors("forbiddenAction", { action: t("deleteForbiddenAction") }),
          });
        } else {
          toast.add({
            title: tErrors("failureTitle"),
            description: result.error,
          });
        }
      }}
    />
  );
}
