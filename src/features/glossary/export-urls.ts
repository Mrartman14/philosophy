// src/features/glossary/export-urls.ts
// Ссылки на .md/.txt-выгрузки глоссария. Без "server-only": нужен тестам.
import { trimApiBase, type ExportUrls } from "@/utils/export-urls";

export type GlossaryExportUrls = ExportUrls;

/**
 * Строит абсолютные URL публичных выгрузок глоссария (контент рендерит бек):
 * - без termId — список: GET /api/glossary.md|.txt;
 * - с termId — термин: GET /api/glossary/{id}.md|.txt.
 *
 * Эндпоинты ПУБЛИЧНЫЕ (только rate-limit, без auth-middleware), поэтому
 * прокси-роут (как у admin-выгрузок events) не нужен — ссылки ведут напрямую
 * на бек.
 */
export function glossaryExportUrls(
  apiBase: string,
  termId?: string,
): GlossaryExportUrls {
  const base = trimApiBase(apiBase);
  const path = termId
    ? `/api/glossary/${encodeURIComponent(termId)}`
    : "/api/glossary";
  return { md: `${base}${path}.md`, txt: `${base}${path}.txt` };
}
