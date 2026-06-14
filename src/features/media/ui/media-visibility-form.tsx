"use client";
// src/features/media/ui/media-visibility-form.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { setMediaVisibility } from "../actions";

interface Props {
  id: string;
  /** canChangeMediaVisibility(me, media) со страницы. */
  canChange: boolean;
}

/**
 * Публикация медиа: private → public. public иммутабелен (downgrade
 * запрещён беком, 422 PUBLIC_IMMUTABLE) — поэтому показываем кнопку только
 * для приватного медиа владельца (canChange).
 */
export function MediaVisibilityForm({ id, canChange }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  if (!canChange) return null;

  return (
    <ConfirmDialog
      trigger={<Button variant="secondary">Опубликовать</Button>}
      title="Опубликовать медиа?"
      description="После публикации медиа станет публичным. Откатить обратно в приватное нельзя — только удалить."
      confirmLabel="Опубликовать"
      onConfirm={async () => {
        const result = await setMediaVisibility({ id, visibility: "public" });
        if (!result.success) {
          if (result.code === "forbidden") {
            toast.add({
              title: "Нет прав",
              description: "У вас нет прав на публикацию медиа.",
            });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
          return;
        }
        toast.add({ title: "Опубликовано" });
        startTransition(() => { router.refresh(); });
      }}
    />
  );
}
