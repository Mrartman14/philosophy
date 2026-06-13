// src/features/search/export-urls.ts
// Чистый helper построения ссылки на .md-выгрузку результатов поиска.
// Без "server-only": нужен тестам; никаких side effects и зависимостей
// (паттерн — src/features/glossary/export-urls.ts).
import type { SearchType } from "./types";

export interface SearchExportParams {
  q: string;
  type?: SearchType | undefined;
}

/**
 * Строит абсолютный URL публичной .md-выгрузки поиска (контент рендерит бек):
 * GET /api/search.md?q=…[&type=…]. Эндпоинт ПУБЛИЧНЫЙ (cmd/server/main.go:1004
 * — optionalAuth + rate-limit, токен не обязателен), поэтому прокси-роут не
 * нужен — ссылка ведёт напрямую на бек. q/type экранируются через
 * URLSearchParams (пробелы, &, кириллица, # и т.п.).
 *
 * limit/offset в ссылку НЕ выносим: выгрузка отдаёт первую страницу
 * результата по дефолту бека (20), как осознанный MVP-компромисс.
 */
export function searchExportMdUrl(
  apiBase: string,
  params: SearchExportParams,
): string {
  const base = apiBase.replace(/\/+$/, "");
  const qs = new URLSearchParams({ q: params.q });
  if (params.type) qs.set("type", params.type);
  return `${base}/api/search.md?${qs.toString()}`;
}
