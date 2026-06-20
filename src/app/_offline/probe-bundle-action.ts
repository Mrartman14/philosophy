// src/app/_offline/probe-bundle-action.ts
"use server";

import "server-only";

import type { ManifestProbe } from "@/services/offline/contract/descriptor";

import { resolveDescriptor } from "./registry";

/** Унифицированный вердикт свежести для оркестратора. `marker` — legacy-ветка
 *  (сравнение делает клиент по своему снимку). */
export type BundleProbe = ManifestProbe | { status: "marker"; marker: string };

/**
 * Ревалидация: при наличии токена — manifest-проба (If-None-Match); skip/нет токена
 * → legacy-маркер. Резолвит дескриптор на сервере (клиент не импортит server-only
 * дескрипторы). Нет freshness → skip. Best-effort: любая ошибка → skip.
 */
export async function probeBundleFreshness(
  entity: string,
  id: string,
  token: string | undefined,
): Promise<BundleProbe> {
  try {
    const freshness = resolveDescriptor(entity)?.freshness;
    if (!freshness) return { status: "skip" };

    if (token !== undefined) {
      const m = await freshness.probeManifest(id, token);
      if (m.status !== "skip") return m; // fresh | stale | gone
    }

    if (!freshness.probeMarker) return { status: "skip" };
    const mk = await freshness.probeMarker(id);
    if (mk.status === "present") return { status: "marker", marker: mk.marker };
    if (mk.status === "gone") return { status: "gone" };
    return { status: "skip" };
  } catch {
    return { status: "skip" };
  }
}

/**
 * Захват стартового freshnessToken при сохранении: manifest-проба без If-None-Match
 * (200 → stale + токен). Возвращает токен или null. Best-effort, не бросает.
 */
export async function captureFreshnessToken(
  entity: string,
  id: string,
): Promise<string | null> {
  try {
    const freshness = resolveDescriptor(entity)?.freshness;
    if (!freshness) return null;
    const m = await freshness.probeManifest(id, undefined);
    return m.status === "stale" ? m.freshnessToken : null;
  } catch {
    return null;
  }
}
