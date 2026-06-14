// src/app/_offline/save-offline.ts
"use client";

import { cacheImage } from "@/services/offline/store/images";
import { requestPersistentStorage } from "@/services/offline/store/persistence";
import {
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";
import { resolveStorageUrl } from "@/utils/storage-url";

import { assembleOfflineBundle } from "./save-offline-action";

export interface SaveOfflineResult {
  ok: boolean;
  error?: string;
}

const OFFLINE_SCHEMA_VERSION = 1;

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

  await requestPersistentStorage();
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
    await updateSavedBundle(entity, id, {
      status: "error",
      error: `Не сохранилось картинок: ${failed} из ${imageKeys.length}`,
    });
    return { ok: false, error: "Сохранено частично — часть картинок недоступна." };
  }
  await updateSavedBundle(entity, id, { status: "complete" });
  return { ok: true };
}
