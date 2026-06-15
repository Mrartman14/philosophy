// src/services/offline/store/saved-bundles.ts
// Browser-only CRUD офлайн-снимков. Ключ выводится из entity+id.
import {
  bundleKey,
  type SavedBundleRecord,
  type SavedBundlePatch,
  type SavedBundleStatus,
} from "../contract/storage";

import { openOfflineDb } from "./db";

export async function putSavedBundle(
  record: Omit<SavedBundleRecord, "key">,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    await db.put("saved-bundles", {
      ...record,
      key: bundleKey(record.entity, record.id),
    });
  } finally {
    db.close();
  }
}

export async function getSavedBundle(
  entity: string,
  id: string,
): Promise<SavedBundleRecord | undefined> {
  const db = await openOfflineDb();
  try {
    return await db.get("saved-bundles", bundleKey(entity, id));
  } finally {
    db.close();
  }
}

export async function listSavedBundles(): Promise<SavedBundleRecord[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAll("saved-bundles");
  } finally {
    db.close();
  }
}

export async function listSavedBundlesByEntity(
  entity: string,
): Promise<SavedBundleRecord[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("saved-bundles", "by-entity", entity);
  } finally {
    db.close();
  }
}

export async function listSavedBundlesByStatus(
  status: SavedBundleStatus,
): Promise<SavedBundleRecord[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("saved-bundles", "by-status", status);
  } finally {
    db.close();
  }
}

/** Мёрж patch в запись (status/error/snapshot/…). No-op, если записи нет. */
export async function updateSavedBundle(
  entity: string,
  id: string,
  patch: SavedBundlePatch,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    const existing = await db.get("saved-bundles", bundleKey(entity, id));
    if (existing) {
      await db.put("saved-bundles", { ...existing, ...patch });
    }
  } finally {
    db.close();
  }
}

export async function deleteSavedBundle(
  entity: string,
  id: string,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    await db.delete("saved-bundles", bundleKey(entity, id));
  } finally {
    db.close();
  }
}

/** Число сохранённых снимков (без загрузки самих записей). */
export async function countSavedBundles(): Promise<number> {
  const db = await openOfflineDb();
  try {
    return await db.count("saved-bundles");
  } finally {
    db.close();
  }
}
