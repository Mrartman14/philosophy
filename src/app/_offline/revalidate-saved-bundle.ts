// src/app/_offline/revalidate-saved-bundle.ts
"use client";

import {
  getSavedBundle,
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { SNAPSHOT_MARKERS } from "./freshness/snapshot-markers";
import { probeBundleFreshness } from "./probe-bundle-action";

export type RevalidateOutcome = "fresh" | "stale" | "gone" | "skip";

/** Снять remoteStatus: re-put записи без поля (update только мёржит; под
 *  exactOptionalPropertyTypes писать `{ remoteStatus: undefined }` нельзя). */
async function clearRemoteStatus(
  rec: NonNullable<Awaited<ReturnType<typeof getSavedBundle>>>,
): Promise<void> {
  if (rec.remoteStatus !== undefined) {
    const cleared = { ...rec };
    delete cleared.remoteStatus;
    await putSavedBundle(cleared);
  }
}

/**
 * Фоновая сверка статуса сохранённой копии (SWR), entity-agnostic. Единый источник
 * истины свежести для страницы сущности и /saved. Копию НИКОГДА не стирает — только
 * проставляет/снимает `remoteStatus`. Best-effort: любая ошибка → "skip". Не бросает.
 */
export async function revalidateSavedBundle(
  entity: string,
  id: string,
): Promise<RevalidateOutcome> {
  try {
    const rec = await getSavedBundle(entity, id);
    if (rec?.status !== "complete") return "skip";

    const probe = await probeBundleFreshness(entity, id, rec.freshnessToken);

    if (probe.status === "fresh") {
      await clearRemoteStatus(rec);
      return "fresh";
    }
    if (probe.status === "stale") {
      await updateSavedBundle(entity, id, {
        remoteStatus: "stale",
        freshnessToken: probe.freshnessToken,
      });
      return "stale";
    }
    if (probe.status === "gone") {
      await updateSavedBundle(entity, id, { remoteStatus: "gone" });
      return "gone";
    }
    if (probe.status === "skip") return "skip";

    // probe.status === "marker": legacy-сравнение по снимку на клиенте.
    const readMarker = SNAPSHOT_MARKERS[entity];
    const savedMarker = readMarker ? readMarker(rec.snapshot) : null;
    if (savedMarker !== null && probe.marker !== savedMarker) {
      // CAS против гонки с ручным «Обновить»: если за время пробы снимок
      // перезаписали свежим — не штампуем ложный stale.
      const current = await getSavedBundle(entity, id);
      const currentMarker =
        readMarker && current ? readMarker(current.snapshot) : null;
      if (currentMarker !== savedMarker) return "skip";
      await updateSavedBundle(entity, id, { remoteStatus: "stale" });
      return "stale";
    }
    await clearRemoteStatus(rec);
    return "fresh";
  } catch {
    return "skip";
  }
}
