// src/features/tags/ui/tag-delete-button.tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { deleteTag } from "../actions";

interface Props {
  id: number;
  name: string;
}

export function TagDeleteButton({ id, name }: Props) {
  const router = useRouter();
  const toast = useToast();
  const tTags = useT("tags");
  const tErrors = useT("errors");
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{tTags("deleteButton")}</Button>}
      title={tTags("deleteTitle", { name })}
      description={tTags("deleteDescription")}
      destructive
      confirmLabel={tTags("deleteButton")}
      onConfirm={async () => {
        const result = await deleteTag(id);
        if (!result.success) {
          toastActionError(toast, tErrors, result, { action: tTags("deleteTagAction") });
          return;
        }
        startTransition(() => { router.refresh(); });
      }}
    />
  );
}
