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
  // pending защищает от повторных кликов, пока считаем библиотеку / выходим
  // (иначе двойной клик = лишние запросы logout + wipe, хоть и идемпотентные).
  const [pending, setPending] = useState(false);

  // Сначала чистим офлайн-кеш (IndexedDB-снимки лекций + Cache Storage
  // картинок), затем серверный логаут (отзыв токенов + redirect). Чистка ДО
  // логаута — чтобы приватные офлайн-данные не пережили смену пользователя на
  // устройстве. wipeOfflineData best-effort (не бросает) — логаут идёт в любом
  // случае. Логаут требует JS (клиентский action) — приемлемо: офлайн и так
  // работает только с JS/Service Worker.
  async function doLogout() {
    setPending(true);
    await wipeOfflineData();
    await logoutAction(); // redirect уводит со страницы
  }

  // Если на устройстве есть сохранённая офлайн-библиотека — предупреждаем, что
  // выход её сотрёт (убираем «молчаливый» сюрприз). Подсчёт на момент клика, а
  // не на mount: отражает реальное состояние именно в момент выхода.
  async function onLogoutClick() {
    if (pending) return;
    setPending(true);
    try {
      const count = await countSavedBundles().catch(() => 0);
      if (count > 0) {
        setConfirmOpen(true);
        setPending(false); // дальше решает пользователь в диалоге
      } else {
        await doLogout(); // pending остаётся true до редиректа
      }
    } catch {
      setPending(false);
    }
  }

  // Почему обычный Dialog, а не ConfirmDialog: ConfirmDialog открывается сразу
  // по триггеру, а нам нужно СПЕРВА дождаться countSavedBundles и решить,
  // показывать ли предупреждение вообще (пустая библиотека → выход без трения).
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-(--color-description)">{username}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
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
            disabled={pending}
            onClick={() => {
              void doLogout().catch(() => {
                setPending(false);
              });
            }}
          >
            Выйти и удалить
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
