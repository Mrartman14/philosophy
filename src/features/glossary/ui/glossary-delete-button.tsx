"use client";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { toastActionError } from "@/utils/action-toast";

import { deleteTerm } from "../actions";

interface Props {
  id: string;
}

export function GlossaryDeleteButton({ id }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { key } = useIdempotencyKey();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить термин?"
      description="Действие необратимо. Если на блоки термина ссылаются другие материалы — удаление будет отклонено."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteTerm(id, key);
        if (!result.success) {
          toastActionError(toast, result, { action: "удаление термина" });
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
