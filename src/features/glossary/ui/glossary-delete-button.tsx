"use client";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

import { deleteTerm } from "../actions";

interface Props {
  id: string;
}

export function GlossaryDeleteButton({ id }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить термин?"
      description="Действие необратимо. Если на блоки термина ссылаются другие материалы — удаление будет отклонено."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteTerm(id);
        if (!result.success) {
          if (result.code === "forbidden") {
            toast.add({
              title: "Нет прав",
              description: "У вас нет прав на удаление термина.",
            });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
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
