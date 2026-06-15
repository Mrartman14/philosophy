// src/features/auth/ui/logout-form.tsx
"use client";
import { useState } from "react";

import { Button, Dialog, DialogClose } from "@/components/ui";
import { countSavedBundles } from "@/services/offline/store/saved-bundles";
import { wipeOfflineData } from "@/services/offline/wipe";

import { logoutAction } from "../actions";

interface LogoutFormProps {
  username: string;
}

export function LogoutForm({ username }: LogoutFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  // Если на устройстве есть сохранённая офлайн-библиотека — предупреждаем, что
  // выход её сотрёт (убираем «молчаливый» сюрприз). Подсчёт на момент клика, а
  // не на mount: отражает реальное состояние именно в момент выхода.
  async function onLogoutClick() {
    const count = await countSavedBundles().catch(() => 0);
    if (count > 0) {
      setConfirmOpen(true);
    } else {
      await doLogout();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-(--color-description)">{username}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void onLogoutClick();
        }}
      >
        Выйти
      </Button>
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Выйти из аккаунта?"
        description="Сохранённые офлайн-материалы будут удалены с этого устройства. После входа их можно скачать заново."
      >
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button variant="ghost">Отмена</Button>} />
          <Button
            variant="danger"
            onClick={() => {
              void doLogout();
            }}
          >
            Выйти и удалить
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
