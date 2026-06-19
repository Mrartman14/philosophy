// src/features/auth/ui/logout-all-form.tsx
"use client";
import { Button, ConfirmDialog } from "@/components/ui";
import { wipeOfflineData } from "@/services/offline/wipe";

import { logoutAllAction } from "../actions";

export function LogoutAllForm() {
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
          Выйти со всех устройств
        </Button>
      }
      title="Выйти со всех устройств?"
      description="Все активные сессии будут завершены на всех устройствах. Сохранённые офлайн-материалы будут удалены с этого устройства."
      destructive
      confirmLabel="Выйти везде"
      onConfirm={doLogoutAll}
    />
  );
}
