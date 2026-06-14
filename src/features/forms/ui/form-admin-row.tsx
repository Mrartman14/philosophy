"use client";
// src/features/forms/ui/form-admin-row.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

import { deleteForm } from "../actions";
import type { FormListItem } from "../types";

interface Props {
  form: FormListItem;
  canDelete: boolean;
}

export function FormAdminRow({ form, canDelete }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <Link href={`/forms/${form.id}`} className="text-sm hover:underline">
        {form.title ?? "Без названия"}
      </Link>
      <div className="flex items-center gap-2">
        <span className="text-xs text-(--color-description)">{form.visibility}</span>
        {canDelete && form.id && (
          <ConfirmDialog
            trigger={<Button variant="danger" size="sm">Удалить</Button>}
            title="Удалить форму?"
            description="Удаляется публичная форма вместе со всеми откликами. Действие необратимо."
            destructive
            confirmLabel="Удалить"
            onConfirm={async () => {
              if (!form.id) return;
              const result = await deleteForm(form.id);
              if (!result.success) {
                toast.add({
                  title: result.code === "forbidden" ? "Нет прав" : "Ошибка",
                  description: result.code === "forbidden" ? "У вас нет прав на удаление формы." : result.error,
                });
                return;
              }
              startTransition(() => { router.refresh(); });
            }}
          />
        )}
      </div>
    </li>
  );
}
