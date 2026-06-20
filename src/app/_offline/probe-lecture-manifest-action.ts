// src/app/_offline/probe-lecture-manifest-action.ts
"use server";

import "server-only";

import { createApiClient } from "@/api/client";
import type { ManifestProbe } from "@/services/offline/contract/descriptor";

/**
 * Дешёвая проверка свежести лекции: GET манифеста с If-None-Match.
 * 304 → не менялось (fresh). 200 → изменилось (stale + новый токен). 404 → gone.
 * Любая иная ошибка/отсутствие токена в ответе → skip (без вердикта).
 */
export async function probeLectureManifest(
  id: string,
  token: string | undefined,
): Promise<ManifestProbe> {
  try {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/manifest", {
      params: {
        path: { id },
        ...(token ? { header: { "If-None-Match": token } } : {}),
      },
    });
    // 304 — проверять ДО error: openapi-fetch кладёт не-2xx в error.
    if (response.status === 304) return { status: "fresh" };
    if (response.status === 404) return { status: "gone" };
    if (error || !response.ok) return { status: "skip" };
    const etag = response.headers.get("ETag");
    // data — non-null (openapi-fetch: 200+ok → тело гарантировано); data.data — optional в схеме
    const versionFallback = data.data?.version != null ? `"${data.data.version}"` : null;
    const next = etag ?? versionFallback;
    if (!next) return { status: "skip" };
    return { status: "stale", freshnessToken: next };
  } catch {
    return { status: "skip" };
  }
}
