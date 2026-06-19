// src/features/auth/ui/logout-all-form.tsx
"use client";
import { Button, ConfirmDialog } from "@/components/ui";
import { useT } from "@/i18n/client";
import { wipeOfflineData } from "@/services/offline/wipe";

import { logoutAllAction } from "../actions";

export function LogoutAllForm() {
  const t = useT("auth");

  // Текущее устройство тоже разлогинивается — logout-all отзывает все сессии,
  // включая текущую. Чистим офлайн-данные перед серверным вызовом, чтобы
  // приватные данные не оставались на устройстве. wipeOfflineData best-effort
  // (не бросает) — logoutAllAction идёт в любом случае.
  async function doLogoutAll() {
    await wipeOfflineData();
    await logoutAllAction();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          {t("logoutAll.trigger")}
        </Button>
      }
      title={t("logoutAll.dialogTitle")}
      description={t("logoutAll.dialogDescription")}
      destructive
      confirmLabel={t("logoutAll.confirmLabel")}
      onConfirm={doLogoutAll}
    />
  );
}
