// src/app/_offline/revalidate-saved-lecture.ts
"use client";

import {
  getSavedBundle,
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { probeLectureForOffline } from "./probe-lecture-action";

export type RevalidateOutcome = "fresh" | "stale" | "gone" | "skip";

/** Достаёт `snapshot.lecture.updated_at` из unknown-снимка; `null`, если формы нет. */
function snapshotUpdatedAt(snapshot: unknown): string | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const lecture = (snapshot as { lecture?: unknown }).lecture;
  if (typeof lecture !== "object" || lecture === null) return null;
  const updatedAt = (lecture as { updated_at?: unknown }).updated_at;
  return typeof updatedAt === "string" ? updatedAt : null;
}

/**
 * Фоновая сверка статуса сохранённой лекции (SWR, ленивый вариант).
 *
 * Копию НИКОГДА не стирает — только проставляет/снимает пометку `remoteStatus`.
 * Best-effort: любая сетевая/иная ошибка → `"skip"` (ничего не трогаем).
 * Никогда не бросает.
 */
export async function revalidateSavedLecture(
  id: string,
): Promise<RevalidateOutcome> {
  try {
    const rec = await getSavedBundle("lectures", id);
    if (rec?.status !== "complete") return "skip";

    const res = await probeLectureForOffline({ id });
    if (!res.success) return "skip";

    if (res.data.status === "gone") {
      await updateSavedBundle("lectures", id, { remoteStatus: "gone" });
      return "gone";
    }

    const savedUpdatedAt = snapshotUpdatedAt(rec.snapshot);
    // Помечаем stale только когда дата снимка известна и отличается от текущей —
    // иначе не мусорим ложным сигналом (best-effort). res.data.updatedAt — string.
    if (savedUpdatedAt !== null && res.data.updatedAt !== savedUpdatedAt) {
      // CAS против гонки с ручным «Обновить»: пока шёл probe, пользователь мог
      // перезаписать снимок свежим (putSavedBundle с новым updated_at). Если
      // дата снимка уже не та, что мы сравнивали, — НЕ штампуем stale, иначе на
      // только что обновлённой копии вспыхнула бы ложная плашка.
      const current = await getSavedBundle("lectures", id);
      if (snapshotUpdatedAt(current?.snapshot) !== savedUpdatedAt) return "skip";
      await updateSavedBundle("lectures", id, { remoteStatus: "stale" });
      return "stale";
    }

    // Снять прежнюю пометку: перезаписываем запись БЕЗ поля remoteStatus.
    // `updateSavedBundle` только мёржит (ключ не удаляет), а под
    // exactOptionalPropertyTypes писать `{ remoteStatus: undefined }` нельзя —
    // поэтому delete + putSavedBundle (re-put локальной записи, без сети).
    if (rec.remoteStatus !== undefined) {
      const cleared = { ...rec };
      delete cleared.remoteStatus;
      await putSavedBundle(cleared);
    }
    return "fresh";
  } catch {
    return "skip";
  }
}
