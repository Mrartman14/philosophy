// src/app/saved/saved-list.tsx
"use client";

import { useEffect, useState } from "react";

import type { LectureSnapshot } from "@/app/_offline/descriptors/lecture-descriptor";
import { RouterLink, Skeleton } from "@/components/ui";
import {
  OFFLINE_SCHEMA_VERSION,
  type SavedBundleRecord,
} from "@/services/offline/contract/storage";
import { whenIdentityReconciled } from "@/services/offline/identity-gate";
import {
  listSavedBundles,
  listSavedBundlesByStatus,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

interface SavedItem {
  id: string;
  title: string;
}

// Снимок в сторе — unknown; каст не защищает. Тотальный гард: невалидный → null (отфильтруем).
function toItem(rec: SavedBundleRecord): SavedItem | null {
  const snap = rec.snapshot as Partial<LectureSnapshot> | null;
  const title = snap?.lecture?.title;
  if (typeof title !== "string") return null;
  return { id: rec.id, title };
}

export function SavedList() {
  const [items, setItems] = useState<SavedItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Не показываем библиотеку прежнего владельца, пока identity-guard не сверит
      // личность (и при смене аккаунта не зачистит кеш).
      await whenIdentityReconciled();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      // Подмести зависшие "saving" (процесс умер между put и финальным update).
      const stale = await listSavedBundlesByStatus("saving");
      for (const rec of stale) {
        await updateSavedBundle(rec.entity, rec.id, {
          status: "error",
          error: "Сохранение прервано — откройте лекцию и сохраните заново.",
        });
      }
      const all = await listSavedBundles();
      const complete = all
        .filter(
          (r) =>
            r.status === "complete" &&
            r.entity === "lectures" &&
            r.schemaVersion === OFFLINE_SCHEMA_VERSION,
        )
        .map(toItem)
        .filter((it): it is SavedItem => it !== null);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (!cancelled) setItems(complete);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Сохранённое офлайн</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">
          Пока ничего не сохранено. Откройте лекцию и нажмите «Сохранить офлайн».
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id}>
              <RouterLink
                href={`/saved/${it.id}`}
                className="block rounded border border-(--color-border) p-3 hover:bg-(--color-text-pane)"
              >
                <span className="font-medium">{it.title}</span>
              </RouterLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
