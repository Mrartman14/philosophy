// src/services/offline/store/images.ts
// Browser-only: кэш картинок офлайна в Cache Storage.
// `<img src="/static/files/{key}">` отдаётся прозрачно из кэша через SW.
import { metrics } from "@/services/observability/core/facade";
import { M } from "@/services/observability/core/names";

import {
  OFFLINE_IMAGE_CACHE,
  BROWSED_IMAGE_CACHE_PREFIX,
  API_CACHE_PREFIX,
} from "../contract/storage";

export async function cacheImage(url: string): Promise<boolean> {
  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin" });
  } catch (e) {
    metrics.increment(M.apiError, { surface: "offline.image", class: "network" });
    throw e;
  }
  metrics.histogram(M.apiDuration, Date.now() - start, {
    surface: "offline.image",
    status: res.status,
  });
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
 * Зачистка ЛЕГАСИ-кэшей просмотренных картинок (`flbz-images` + версионированные
 * `flbz-images-*` от прежних сборок). Браузерное кеширование убрано — новые SW их
 * не заводят; функция сносит остатки на устройствах при смене аккаунта (если новый
 * SW ещё не активировался и не снёс их сам в activate).
 */
export async function clearBrowsedImageCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(BROWSED_IMAGE_CACHE_PREFIX))
      .map((key) => caches.delete(key)),
  );
}

/**
 * Defense-in-depth: удаляет ВЕРСИОНИРОВАННЫЕ кэши ответов `/api/*`
 * (`flbz-api-*`, network-first в public/sw.js). Сегодня браузер same-origin GET
 * к `/api` не делает (бэкенд — отдельный origin, SW cross-origin пропускает), так
 * что кэш фактически пуст; чистим на случай переезда бэкенда на тот же origin или
 * появления Next-route под `/api` с приватными данными — чтобы они не пережили
 * смену аккаунта на общем устройстве.
 */
export async function clearApiCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(API_CACHE_PREFIX))
      .map((key) => caches.delete(key)),
  );
}
