// src/services/offline/store/persistence.ts
// Browser-only: защита явно сохранённого контента от LRU-вытеснения origin'а.
// Feature-detection через тип с опциональными методами — иначе lib.dom считает
// navigator.storage и его методы всегда-определёнными и no-unnecessary-condition
// отвергнет рантайм-гард (нужный для старых браузеров/SSR).
export interface OfflineStorageEstimate {
  usage: number;
  quota: number;
}

interface MaybeStorageManager {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<StorageEstimate>;
}

function offlineStorage(): MaybeStorageManager | undefined {
  return navigator.storage as MaybeStorageManager | undefined;
}

export async function requestPersistentStorage(): Promise<boolean> {
  const storage = offlineStorage();
  if (!storage || typeof storage.persist !== "function") return false;
  return storage.persist();
}

export async function isStoragePersisted(): Promise<boolean> {
  const storage = offlineStorage();
  if (!storage || typeof storage.persisted !== "function") return false;
  return storage.persisted();
}

export async function getStorageEstimate(): Promise<OfflineStorageEstimate> {
  const storage = offlineStorage();
  if (!storage || typeof storage.estimate !== "function") {
    return { usage: 0, quota: 0 };
  }
  const estimate = await storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
