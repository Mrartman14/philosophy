// src/app/_offline/save-offline.ts
"use client";

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";
import { cacheImage } from "@/services/offline/store/images";
import { requestPersistentStorage } from "@/services/offline/store/persistence";
import {
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";
import { resolveStorageUrl } from "@/utils/storage-url";

import { captureFreshnessToken } from "./probe-bundle-action";
import { assembleOfflineBundle } from "./save-offline-action";

export interface SaveOfflineResult {
  ok: boolean;
  error?: string;
  /** Сохранено, но хранилище хрупкое (persist() отказал) — данные могут вытесниться. */
  warning?: string;
}

const QUOTA_ERROR =
  "Недостаточно места на устройстве для офлайн-сохранения.";
const STORAGE_ERROR = "Не удалось сохранить офлайн.";
// persist() отказан: на iOS/Safari origin вытесняется по LRU (целиком, после
// ~7 дней без захода) — честно предупреждаем, что сохранённое не вечно.
const NOT_PERSISTED_WARNING =
  "Сохранено, но браузер может удалить офлайн-данные при нехватке места.";

/** QuotaExceededError приходит как DOMException (не наследует Error) — матчим по name. */
function isQuotaError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name?: unknown }).name === "QuotaExceededError"
  );
}

async function markBundleError(
  entity: string,
  id: string,
  error: string,
): Promise<void> {
  // no-op, если записи ещё нет (put упал на квоте до создания) — допустимо.
  try {
    await updateSavedBundle(entity, id, { status: "error", error });
  } catch {
    // best-effort: пометка статуса не должна перекрывать исходную ошибку.
  }
}

/** Сохранить сущность офлайн: server-снимок → IndexedDB + картинки в Cache Storage. */
export async function saveOffline(
  entity: string,
  id: string,
): Promise<SaveOfflineResult> {
  const result = await assembleOfflineBundle({ entity, id });
  if (!result.success) return { ok: false, error: result.error };
  if (!result.data) {
    return { ok: false, error: "Сущность недоступна для сохранения." };
  }
  const { snapshot, imageKeys } = result.data;

  // persist() — главный (и единственный) рычаг durability. Берём результат:
  // при отказе сохранение не блокируем, но предупреждаем о хрупкости хранилища.
  const persisted = await requestPersistentStorage();

  try {
    await putSavedBundle({
      entity,
      id,
      savedAt: new Date().toISOString(),
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      status: "saving",
      snapshot,
      imageKeys,
    });

    let failed = 0;
    for (const key of imageKeys) {
      // resolveStorageUrl — единая точка истины URL (та же, что рендерит view):
      // Cache Storage матчит по полному URL, поэтому хардкодить /static/files
      // нельзя — при NEXT_PUBLIC_STORAGE_URL (CDN) src разойдётся с кэшем.
      const cached = await cacheImage(resolveStorageUrl(key));
      if (!cached) failed++;
    }

    if (failed > 0) {
      await markBundleError(
        entity,
        id,
        `Не сохранилось картинок: ${failed} из ${imageKeys.length}`,
      );
      return {
        ok: false,
        error: "Сохранено частично — часть картинок недоступна.",
      };
    }
    await updateSavedBundle(entity, id, { status: "complete" });

    // Best-effort захват freshnessToken для последующего If-None-Match
    // (304-fast-path). Generic: токен резолвится через freshness-capability
    // дескриптора. Бандл уже сохранён — ошибка/null здесь НЕ ломают результат.
    const token = await captureFreshnessToken(entity, id);
    if (token !== null) {
      await updateSavedBundle(entity, id, { freshnessToken: token });
    }

    return persisted ? { ok: true } : { ok: true, warning: NOT_PERSISTED_WARNING };
  } catch (e) {
    // Квота/сбой записи: не роняем промис (кнопка иначе залипает без .catch) —
    // помечаем снимок error и возвращаем понятную причину.
    const error = isQuotaError(e) ? QUOTA_ERROR : STORAGE_ERROR;
    await markBundleError(entity, id, error);
    return { ok: false, error };
  }
}
