// Единый источник дефолта API_URL. Лёгкий модуль БЕЗ openapi-fetch/observability —
// безопасен для edge/middleware (proxy.ts) и для слайсов.
export const API_URL = process.env.API_URL ?? "http://localhost:8080";
