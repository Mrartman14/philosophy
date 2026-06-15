"use client";
import { useEffect } from "react";

import { clearOfflineOwner } from "./owner";
import { wipeOfflineData } from "./wipe";

/**
 * Невидимый компонент: на `/login?blocked=1` один раз стирает все локальные
 * данные забаненного — IndexedDB + Cache Storage (`wipeOfflineData`) и маркер
 * владельца в localStorage (`clearOfflineOwner`). Это несущая, кросс-браузерно
 * надёжная зачистка; httpOnly-cookie и заголовок `Clear-Site-Data` отрабатывает
 * route handler `/auth/forced-logout`. Best-effort, не блокирует рендер.
 */
export function ForcedLogoutCleanup() {
  useEffect(() => {
    void (async () => {
      await wipeOfflineData();
      clearOfflineOwner();
    })();
  }, []);
  return null;
}
