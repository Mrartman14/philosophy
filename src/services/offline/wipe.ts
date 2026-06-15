// src/services/offline/wipe.ts
// Browser-only: полная зачистка офлайн-данных текущего origin.
import { wipeOfflineDb } from "./store/db";
import { clearImageCache, clearBrowsedImageCaches } from "./store/images";

/**
 * Best-effort полная зачистка офлайн-кеша: IndexedDB-сторы (saved-bundles +
 * outbox), Cache Storage офлайн-картинок и версионированные LRU-кэши просмотренных
 * картинок (`flbz-images-*`). Подсистемы чистятся независимо (`allSettled`) — сбой
 * одной не мешает другим, функция никогда не бросает.
 *
 * Вызывается при логауте: приватные снимки лекций и очередь мутаций не должны
 * пережить смену пользователя на общем устройстве.
 *
 * Возвращает `true`, только если ВСЕ подсистемы отстрелялись без сбоя. Вызыватель
 * (`reconcileOfflineOwner`) фиксирует нового владельца лишь при `true` — иначе
 * частично-зачищенные приватные данные осели бы под новым аккаунтом без шанса на
 * повторную зачистку (маркер бы уже совпал).
 *
 * НАМЕРЕННО НЕ чистим Cache `flbz-shell` (SAVED_SHELL_CACHE): это app-shell
 * раздела /saved (скелет HTML/JS, одинаков для всех), а не приватные данные —
 * сам контент рендерится клиентом из IndexedDB, который здесь и стирается.
 */
export async function wipeOfflineData(): Promise<boolean> {
  const results = await Promise.allSettled([
    wipeOfflineDb(),
    clearImageCache(),
    clearBrowsedImageCaches(),
  ]);
  return results.every((r) => r.status === "fulfilled");
}
