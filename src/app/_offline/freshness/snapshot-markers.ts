// src/app/_offline/freshness/snapshot-markers.ts
// client-safe: чистое per-entity извлечение legacy-маркера свежести (updated_at)
// из сохранённого снимка. Нужен оркестратору ревалидации для marker-сравнения
// (бандлы без freshnessToken). Никаких server-only зависимостей — импортируется
// из client-компонентов и client-оркестратора.
import { Tags } from "@/api/tags";

/** Достаёт `snapshot.lecture.updated_at`; null, если формы нет. */
function lectureMarker(snapshot: unknown): string | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const lecture = (snapshot as { lecture?: unknown }).lecture;
  if (typeof lecture !== "object" || lecture === null) return null;
  const updatedAt = (lecture as { updated_at?: unknown }).updated_at;
  return typeof updatedAt === "string" ? updatedAt : null;
}

/** entity → извлекатель маркера. Сущности без legacy-пути сюда не попадают. */
export const SNAPSHOT_MARKERS: Record<string, (snapshot: unknown) => string | null> = {
  [Tags.LECTURES]: lectureMarker,
};
