// src/features/auth/ui/logout-form.tsx
"use client";
import { Button, ConfirmDialog } from "@/components/ui";
import { useT } from "@/i18n/client";
import { countSavedBundles } from "@/services/offline/store/saved-bundles";
import { wipeOfflineData } from "@/services/offline/wipe";

import { logoutAction } from "../actions";

export function LogoutForm() {
  const t = useT("auth");

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
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          {t("logout.trigger")}
        </Button>
      }
      title={t("logout.dialogTitle")}
      description={t("logout.dialogDescription")}
      destructive
      confirmLabel={t("logout.confirmLabel")}
      onConfirm={doLogout}
      shouldConfirm={async () => (await countSavedBundles().catch(() => 0)) > 0}
    />
  );
}
