// src/app/_offline/revalidate-saved-lecture.ts
"use client";

import {
  getSavedBundle,
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { probeLectureForOffline } from "./probe-lecture-action";
import { probeLectureManifest } from "./probe-lecture-manifest-action";

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
 * Снять пометку remoteStatus: перезаписываем запись БЕЗ поля remoteStatus.
 * `updateSavedBundle` только мёржит (ключ не удаляет), а под
 * exactOptionalPropertyTypes писать `{ remoteStatus: undefined }` нельзя —
 * поэтому delete + putSavedBundle (re-put локальной записи, без сети).
 */
async function clearRemoteStatus(
  rec: Awaited<ReturnType<typeof getSavedBundle>> & object,
): Promise<void> {
  if (rec.remoteStatus !== undefined) {
    const cleared = { ...rec };
    delete cleared.remoteStatus;
    await putSavedBundle(cleared);
  }
}

/**
 * Ветка legacy-ревалидации через полный probe (`probeLectureForOffline`).
 * Используется при отсутствии freshnessToken или при manifest-skip.
 */
async function legacyRevalidate(
  id: string,
  rec: NonNullable<Awaited<ReturnType<typeof getSavedBundle>>>,
): Promise<RevalidateOutcome> {
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

  // Снять прежнюю пометку (re-put без remoteStatus, см. clearRemoteStatus).
  await clearRemoteStatus(rec);
  return "fresh";
}

/**
 * Фоновая сверка статуса сохранённой лекции (SWR, ленивый вариант).
 *
 * Если запись содержит `freshnessToken` — сначала пробуем дешёвый manifest-probe
 * (304-fast-path). Результат skip → фолбэк на legacy-probe. При отсутствии токена
 * сразу идём по legacy-ветке (полная совместимость со старыми бандлами).
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

    // Manifest-путь: быстрая проверка через If-None-Match (304-fast-path).
    if (rec.freshnessToken !== undefined) {
      const probe = await probeLectureManifest(id, rec.freshnessToken);

      if (probe.status === "fresh") {
        // Лекция не менялась — снять прежнюю пометку и вернуть fresh.
        await clearRemoteStatus(rec);
        return "fresh";
      }

      if (probe.status === "stale") {
        // Лекция изменилась — сохранить новый токен и пометить stale.
        await updateSavedBundle("lectures", id, {
          remoteStatus: "stale",
          freshnessToken: probe.freshnessToken,
        });
        return "stale";
      }

      if (probe.status === "gone") {
        await updateSavedBundle("lectures", id, { remoteStatus: "gone" });
        return "gone";
      }

      // probe.status === "skip": manifest недоступен/не отвечает — фолбэк на legacy.
    }

    // Legacy-путь: полный probe + сравнение updated_at.
    // Используется и для старых бандлов без freshnessToken.
    return await legacyRevalidate(id, rec);
  } catch {
    return "skip";
  }
}
