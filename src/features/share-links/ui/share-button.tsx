"use client";
// src/features/share-links/ui/share-button.tsx
import { useState } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { ShareLink, ResourceType } from "../types";

import { ShareDialog } from "./share-dialog";

interface Props {
  resourceType: ResourceType;
  resourceId: string;
  /** Владелец приватного ресурса? Считается на сервере (canCreateShareLink). */
  canCreate: boolean;
  /** Уже выпущенные ссылки ресурса (server fetch). */
  initialLinks: ShareLink[];
}

/**
 * Кнопка «Поделиться» для detail-страниц: Button-триггер + ShareDialog со списком
 * и формой. Показывается только владельцу приватного ресурса (canCreate).
 */
export function ShareButton({ resourceType, resourceId, canCreate, initialLinks }: Props) {
  const t = useT("shareLinks");
  const [open, setOpen] = useState(false);
  if (!canCreate) return null;
  return (
    <ShareDialog
      resourceType={resourceType}
      resourceId={resourceId}
      initialLinks={initialLinks}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" tone="quiet">
          {t("shareButtonLabel")}
        </Button>
      }
    />
  );
}
