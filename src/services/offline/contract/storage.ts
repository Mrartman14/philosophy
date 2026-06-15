// src/services/offline/contract/storage.ts
// Generic типы и константы слоя персистентности офлайна (entity-agnostic).
// Без рантайм/браузерных зависимостей — безопасно импортировать откуда угодно.

export const OFFLINE_DB_NAME = "flbz-offline";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_IMAGE_CACHE = "flbz-offline-images";
/**
 * Префикс ВЕРСИОНИРОВАННЫХ LRU-кэшей просмотренных картинок в Cache Storage
 * (`flbz-images-<SW_VERSION>`, заводится в public/sw.js). Не путать с
 * `OFFLINE_IMAGE_CACHE` (`flbz-offline-images`): у того другой префикс, под фильтр
 * по этой строке он НЕ попадает — проверять при изменении любого из имён.
 */
export const LRU_IMAGE_CACHE_PREFIX = "flbz-images-";
/** localStorage-ключ: id владельца офлайн-кеша (для сверки личности при логауте). */
export const OFFLINE_OWNER_KEY = "flbz-offline-owner";

/** Ключ снимка в сторе saved-bundles. */
export function bundleKey(entity: string, id: string): string {
  return `${entity}:${id}`;
}

export type SavedBundleStatus = "saving" | "complete" | "error";

/**
 * Generic офлайн-снимок любой сущности.
 * `snapshot` — entity-specific (форму знает дескриптор сущности / её view),
 * слой персистентности её не интерпретирует.
 */
export interface SavedBundleRecord<TSnapshot = unknown> {
  key: string; // bundleKey(entity, id) — keyPath стора, выводится слоем
  entity: string; // === Tags.* (@/api/tags), напр. "lectures"
  id: string;
  savedAt: string; // ISO, проставляется на клиенте
  schemaVersion: number;
  status: SavedBundleStatus;
  error?: string;
  snapshot: TSnapshot;
  imageKeys: string[]; // sha256-ключи картинок для Cache Storage
}

/** Патч записи снимка (служебные ключи менять нельзя). */
export type SavedBundlePatch = Partial<
  Omit<SavedBundleRecord, "key" | "entity" | "id">
>;

export type OutboxStatus = "pending" | "syncing" | "failed" | "done";

/** Сейчас только create; update/delete — позже (уровень 2, нужен version-токен). */
export type OutboxOp = "create";

/**
 * Generic команда офлайн-записи. `payload` — entity-specific
 * (форму знает descriptor.write соответствующей сущности).
 */
export interface OutboxCommand<TPayload = unknown> {
  clientId: string; // crypto.randomUUID(): temp-id == idempotency-key == reconcile-key
  entity: string; // === Tags.* (@/api/tags), напр. Tags.ANNOTATIONS === "annotations"
  op: OutboxOp;
  payload: TPayload;
  createdAt: string; // ISO
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  serverId?: string;
}

/** Патч команды (clientId неизменяем). */
export type OutboxPatch = Partial<Omit<OutboxCommand, "clientId">>;

/** Вход для постановки в очередь; служебные поля проставляет enqueue. */
export type OutboxEnqueueInput<TPayload = unknown> = Pick<
  OutboxCommand<TPayload>,
  "entity" | "op" | "payload"
> & {
  clientId?: string; // по умолчанию crypto.randomUUID()
  createdAt?: string; // по умолчанию new Date().toISOString()
};
