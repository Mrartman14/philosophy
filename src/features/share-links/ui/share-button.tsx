"use client";
// src/features/share-links/ui/share-button.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button, Dialog, TextInput, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createShareLink } from "../actions";
import { RESOURCE_TYPE_LABELS } from "../types";
import type { ShareLink, ResourceType } from "../types";

import { ShareLinkList } from "./share-link-list";

interface Props {
  resourceType: ResourceType;
  resourceId: string;
  /** Владелец приватного ресурса? Считается на сервере (canCreateShareLink). */
  canCreate: boolean;
  /** Уже выпущенные ссылки ресурса (server fetch). */
  initialLinks: ShareLink[];
}

const initialState: ActionResult<ShareLink | null> = {
  success: true,
  data: null,
};

/**
 * Кнопка «Поделиться» для detail-страниц. Открывает Dialog со списком
 * существующих ссылок ресурса и формой создания новой. Показывается только
 * владельцу приватного ресурса (canCreate). Создание — server action
 * createShareLink; после успеха router.refresh() обновляет список.
 */
export function ShareButton({
  resourceType,
  resourceId,
  canCreate,
  initialLinks,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createShareLink,
    initialState,
  );

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: "Ссылка создана" });
      router.refresh();
    } else if (!state.success) {
      const msg =
        state.code === "forbidden"
          ? "У вас нет прав на создание ссылки."
          : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!canCreate) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="ghost">
          Поделиться
        </Button>
      }
      title={`Поделиться: ${RESOURCE_TYPE_LABELS[resourceType]}`}
      description="Ссылка открывает приватный ресурс держателю без входа."
    >
      <div className="flex flex-col gap-4">
        <form action={formAction} className="flex items-end gap-2">
          <input type="hidden" name="resource_type" value={resourceType} />
          <input type="hidden" name="resource_id" value={resourceId} />
          <label htmlFor="expires_at" className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-(--color-description)">
              Срок действия (необязательно)
            </span>
            <TextInput id="expires_at" type="datetime-local" name="expires_at" />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Создать ссылку"}
          </Button>
        </form>

        <ShareLinkList
          links={initialLinks}
          resourceType={resourceType}
          resourceId={resourceId}
        />
      </div>
    </Dialog>
  );
}
