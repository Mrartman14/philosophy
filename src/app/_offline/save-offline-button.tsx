// src/app/_offline/save-offline-button.tsx
"use client";

import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";

import { saveOffline } from "./save-offline";

/** Generic-кнопка «Сохранить офлайн» для любой сущности из OFFLINE_REGISTRY. */
export function SaveOfflineButton({
  entity,
  id,
}: {
  entity: string;
  id: string;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();
  const t = useT("pages");

  if (saved) {
    return (
      <span className="text-sm text-(--color-fg-muted)">{t("savedLectureSavedBadge")}</span>
    );
  }

  const onClick = (): void => {
    setSaving(true);
    void saveOffline(entity, id).then((result) => {
      setSaving(false);
      if (result.ok) {
        setSaved(true);
        toast.add({
          title: t("saveOfflineSuccessTitle"),
          description: result.warning,
        });
      } else {
        toast.add({
          title: t("saveOfflineFailTitle"),
          description: result.error,
        });
      }
    });
  };

  return (
    <Button type="button" variant="secondary" disabled={saving} onClick={onClick}>
      {saving ? t("saveOfflineSaving") : t("saveOfflineButton")}
    </Button>
  );
}
