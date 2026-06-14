import createClient from "openapi-fetch";

import type { paths } from "./schema";

export const API_URL = process.env.API_URL ?? "http://localhost:8080";

/** Серверный клиент — автоматически прикладывает JWT из cookie */
export async function createApiClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  return createClient<paths>({
    baseUrl: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Публичный клиент без токена — для открытых эндпоинтов */
export function createPublicApiClient() {
  return createClient<paths>({
    baseUrl: API_URL,
  });
}
