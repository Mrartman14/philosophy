// src/app/_offline/save-offline-button.tsx
"use client";

import { useState } from "react";

import { Button, useToast } from "@/components/ui";

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

  if (saved) {
    return (
      <span className="text-sm text-(--color-description)">Сохранено офлайн ✓</span>
    );
  }

  const onClick = (): void => {
    setSaving(true);
    void saveOffline(entity, id).then((result) => {
      setSaving(false);
      if (result.ok) {
        setSaved(true);
        toast.add({
          title: "Сохранено для офлайна",
          description: result.warning,
        });
      } else {
        toast.add({
          title: "Не удалось сохранить офлайн",
          description: result.error,
        });
      }
    });
  };

  return (
    <Button type="button" variant="secondary" disabled={saving} onClick={onClick}>
      {saving ? "Сохранение…" : "Сохранить офлайн"}
    </Button>
  );
}
