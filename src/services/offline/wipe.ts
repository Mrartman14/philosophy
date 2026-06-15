// src/services/offline/wipe.ts
// Browser-only: полная зачистка офлайн-данных текущего origin.
import { wipeOfflineDb } from "./store/db";
import { clearImageCache } from "./store/images";

/**
 * Best-effort полная зачистка офлайн-кеша: IndexedDB-сторы (saved-bundles +
 * outbox) и Cache Storage картинок. Подсистемы чистятся независимо
 * (`allSettled`) — сбой одной не мешает другой, функция никогда не бросает.
 *
 * Вызывается при логауте: приватные снимки лекций и очередь мутаций не должны
 * пережить смену пользователя на общем устройстве.
 *
 * НАМЕРЕННО НЕ чистим Cache `flbz-shell` (SAVED_SHELL_CACHE): это app-shell
 * раздела /saved (скелет HTML/JS, одинаков для всех), а не приватные данные —
 * сам контент рендерится клиентом из IndexedDB, который здесь и стирается.
 */
export async function wipeOfflineData(): Promise<void> {
  await Promise.allSettled([wipeOfflineDb(), clearImageCache()]);
}
