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
 */
export async function wipeOfflineData(): Promise<void> {
  await Promise.allSettled([wipeOfflineDb(), clearImageCache()]);
}
