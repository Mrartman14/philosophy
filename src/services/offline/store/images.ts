// src/services/offline/store/images.ts
// Browser-only: кэш картинок офлайна в Cache Storage.
// `<img src="/static/files/{key}">` отдаётся прозрачно из кэша через SW.
import { OFFLINE_IMAGE_CACHE } from "../contract/storage";

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
