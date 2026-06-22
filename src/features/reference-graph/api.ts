import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { GraphData } from "./types";

/** Результат загрузки графа: готов / ещё строится (503 GRAPH_NOT_READY) / ошибка. */
export type GraphResult =
  | { ok: true; graph: GraphData }
  | { ok: false; reason: "building" | "error" };

/**
 * Граф связности корпуса. Read-only, optional-auth (createApiClient приложит JWT из cookie —
 * бэк скоупит срез по видимости, но граф анонимно-публичный). ETag/304 в v1 не используем.
 */
export const getGraph = cache(async (): Promise<GraphResult> => {
  try {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/graph");
    if (error) {
      if (response.status === 503) return { ok: false, reason: "building" };
      return { ok: false, reason: "error" };
    }
    const graph = data.data;
    if (!graph) return { ok: false, reason: "error" };
    return { ok: true, graph };
  } catch {
    return { ok: false, reason: "error" };
  }
});
