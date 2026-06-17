import createClient, { type Middleware } from "openapi-fetch";

import { getServerContext } from "@/services/observability/context/server";
import { errors, metrics } from "@/services/observability/core/facade";
import { M } from "@/services/observability/core/names";

import type { paths } from "./schema";

export const API_URL = process.env.API_URL ?? "http://localhost:8080";

// Длительность запроса меряется по id middleware-вызова: openapi-fetch гарантирует
// парность onRequest/onResponse/onError с одним и тем же params.id.
const startedAt = new Map<string, number>();

/** Наблюдаемость для обоих openapi-клиентов: X-Request-Id + api.duration / api.error. */
const observability: Middleware = {
  onRequest({ request, id }) {
    const requestId = getServerContext().requestId;
    if (requestId) request.headers.set("X-Request-Id", requestId);
    startedAt.set(id, Date.now());
    return request;
  },
  onResponse({ request, response, schemaPath, id }) {
    const start = startedAt.get(id);
    startedAt.delete(id);
    metrics.histogram(M.apiDuration, start === undefined ? 0 : Date.now() - start, {
      method: request.method,
      route: schemaPath,
      status: response.status,
    });
    return response;
  },
  onError({ request, schemaPath, error, id }) {
    startedAt.delete(id);
    metrics.increment(M.apiError, {
      method: request.method,
      route: schemaPath,
      class: "network",
    });
    errors.capture(error, { errorClass: "network", handled: false });
  },
};

/** Серверный клиент — автоматически прикладывает JWT из cookie */
export async function createApiClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const client = createClient<paths>({
    baseUrl: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  client.use(observability);
  return client;
}

/** Публичный клиент без токена — для открытых эндпоинтов */
export function createPublicApiClient() {
  const client = createClient<paths>({
    baseUrl: API_URL,
  });
  client.use(observability);
  return client;
}
