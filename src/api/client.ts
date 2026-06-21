import createClient, { type Middleware } from "openapi-fetch";

import { errors, log, metrics, M } from "@/services/observability";
import { getContext } from "@/services/observability/core/registry";

import { API_URL } from "./base-url";
import type { paths } from "./schema";

// Реэкспорт публичного дефолта: существующие `import { API_URL } from "@/api/client"`
// продолжают работать; единый источник — ./base-url (edge-safe).
export { API_URL };

// Длительность запроса меряется по id middleware-вызова: openapi-fetch гарантирует
// парность onRequest/onResponse/onError с одним и тем же params.id.
const startedAt = new Map<string, number>();

/** Наблюдаемость для обоих openapi-клиентов: X-Request-Id + api.duration / api.error. */
const observability: Middleware = {
  onRequest({ request, id }) {
    const requestId = getContext().requestId;
    if (requestId) request.headers.set("X-Request-Id", requestId);
    startedAt.set(id, Date.now());
    return request;
  },
  onResponse({ request, response, schemaPath, id }) {
    const start = startedAt.get(id);
    startedAt.delete(id);
    if (start === undefined) {
      log.warn("api.request.duration: missing start", { id });
      return response;
    }
    metrics.histogram(M.apiRequestDuration, Date.now() - start, {
      transport: "openapi",
      method: request.method,
      route: schemaPath,
      status: response.status,
    });
    return response;
  },
  onError({ request, schemaPath, error, id }) {
    startedAt.delete(id);
    metrics.increment(M.apiRequestError, {
      transport: "openapi",
      method: request.method,
      route: schemaPath,
      errorClass: "network",
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
