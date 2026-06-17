// src/services/observability/server-fetch.ts
// Общая инструментованная обёртка над raw fetch: ставит X-Request-Id из
// серверного контекста, меряет длительность и пишет api.duration / api.error.
import "server-only";

import { getServerContext } from "./context/server";
import { errors, metrics } from "./core/facade";
import { M } from "./core/names";

/**
 * Оборачивает raw fetch. `surface` — стабильный логический идентификатор места
 * вызова (media.upload, export.proxy, …): схема пути не известна, поэтому
 * метку route заменяет surface. Тело запроса НЕ читается (multipart-safe).
 */
export async function instrumentedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  meta?: { surface: string },
): Promise<Response> {
  const surface = meta?.surface ?? "fetch";
  const requestId = getServerContext().requestId;

  const headers = new Headers(init?.headers);
  if (requestId) headers.set("X-Request-Id", requestId);
  const finalInit: RequestInit = { ...init, headers };

  const start = Date.now();
  try {
    const res = await fetch(input, finalInit);
    metrics.histogram(M.apiRequestDuration, Date.now() - start, {
      transport: "fetch",
      surface,
      status: res.status,
    });
    return res;
  } catch (e) {
    metrics.increment(M.apiRequestError, { transport: "fetch", surface, errorClass: "network" });
    errors.capture(e, { errorClass: "network", handled: false });
    throw e;
  }
}
