"use client";
// src/features/events/ui/event-delete-button.tsx
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { toastActionError } from "@/utils/action-toast";

import { deleteEvent } from "../actions";

interface Props {
  id: string;
}

export function EventDeleteButton({ id }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить событие?"
      description="Действие необратимо. Событие исчезнет из публичного календаря."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteEvent(id, key);
        if (!result.success) {
          toastActionError(toast, result, { action: "удаление события" });
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
