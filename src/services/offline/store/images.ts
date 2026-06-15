// src/services/offline/store/images.ts
// Browser-only: кэш картинок офлайна в Cache Storage.
// `<img src="/static/files/{key}">` отдаётся прозрачно из кэша через SW.
import { OFFLINE_IMAGE_CACHE, LRU_IMAGE_CACHE_PREFIX } from "../contract/storage";

export async function cacheImage(url: string): Promise<boolean> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return false;
  const cache = await caches.open(OFFLINE_IMAGE_CACHE);
  await cache.put(url, res);
  return true;
}

export async function hasCachedImage(url: string): Promise<boolean> {
  const cache = await caches.open(OFFLINE_IMAGE_CACHE);
  return (await cache.match(url)) !== undefined;
}

export async function matchCachedImage(
  url: string,
): Promise<Response | undefined> {
  const cache = await caches.open(OFFLINE_IMAGE_CACHE);
  return cache.match(url);
}

/** Удаляет кэш офлайн-картинок целиком. Вызывается при логауте. */
export async function clearImageCache(): Promise<void> {
  await caches.delete(OFFLINE_IMAGE_CACHE);
}

/**
 * Defense-in-depth: удаляет ВЕРСИОНИРОВАННЫЕ LRU-кэши просмотренных картинок
 * (`flbz-images-*`). Сейчас offlineFileFirst из них не читает (content-addressed
 * файлы отдаются только из OFFLINE_IMAGE_CACHE), но не оставляем картинки прежнего
 * владельца на общем устройстве при смене аккаунта.
 */
export async function clearBrowsedImageCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(LRU_IMAGE_CACHE_PREFIX))
      .map((key) => caches.delete(key)),
  );
}
