// src/features/auth/ui/logout-form.tsx
"use client";
import { Button, ConfirmDialog } from "@/components/ui";
import { countSavedBundles } from "@/services/offline/store/saved-bundles";
import { wipeOfflineData } from "@/services/offline/wipe";

import { logoutAction } from "../actions";

interface LogoutFormProps {
  username: string;
}

export function LogoutForm({ username }: LogoutFormProps) {
  // Сначала чистим офлайн-кеш (IndexedDB-снимки лекций + Cache Storage
  // картинок), затем серверный логаут (отзыв токенов + redirect). Чистка ДО
  // логаута — чтобы приватные офлайн-данные не пережили смену пользователя на
  // устройстве. wipeOfflineData best-effort (не бросает) — логаут идёт в любом
  // случае. Логаут требует JS (клиентский action) — приемлемо: офлайн и так
  // работает только с JS/Service Worker.
  async function doLogout() {
    await wipeOfflineData();
    await logoutAction();
  }

  // Предупреждаем об удалении офлайн-данных только если на устройстве есть
  // сохранённая библиотека (подсчёт на момент клика). Пустая → выход без трения.
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-(--color-description)">{username}</span>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm">
            Выйти
          </Button>
        }
        title="Выйти из аккаунта?"
        description="Сохранённые офлайн-материалы будут удалены с этого устройства. После входа их можно скачать заново."
        destructive
        confirmLabel="Выйти и удалить"
        onConfirm={doLogout}
        shouldConfirm={async () => (await countSavedBundles().catch(() => 0)) > 0}
      />
    </div>
  );
}
