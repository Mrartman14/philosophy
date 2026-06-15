// src/features/auth/ui/logout-form.tsx
"use client";
import { Button } from "@/components/ui";
import { wipeOfflineData } from "@/services/offline/wipe";

import { logoutAction } from "../actions";

interface LogoutFormProps {
  username: string;
}

export function LogoutForm({ username }: LogoutFormProps) {
  // Клиентская часть логаута: сначала чистим офлайн-кеш (IndexedDB-снимки
  // лекций + Cache Storage картинок), затем серверный логаут с отзывом токенов
  // и редиректом. Чистка ДО логаута — чтобы приватные офлайн-данные не пережили
  // смену пользователя на общем устройстве. wipeOfflineData best-effort (не
  // бросает), поэтому логаут выполняется при любом исходе зачистки.
  //
  // Логаут требует JS (клиентский action) — приемлемо: офлайн-возможности и так
  // работают только с включённым JS/Service Worker.
  async function handleLogout() {
    await wipeOfflineData();
    await logoutAction();
  }

  return (
    <form action={handleLogout} className="flex items-center gap-2">
      <span className="text-sm text-(--color-description)">{username}</span>
      <Button type="submit" variant="ghost" size="sm">
        Выйти
      </Button>
    </form>
  );
}
