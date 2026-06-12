// src/features/glossary/export-urls.ts
// Чистый helper построения ссылок на .md/.txt-выгрузки глоссария.
// Без "server-only": нужен тестам; никаких side effects и зависимостей
// (паттерн — src/features/events/calendar.ts).

export interface GlossaryExportUrls {
  md: string;
  txt: string;
}

/**
 * Строит абсолютные URL публичных выгрузок глоссария (контент рендерит бек):
 * - без termId — список: GET /api/glossary.md|.txt;
 * - с termId — термин: GET /api/glossary/{id}.md|.txt.
 *
 * Эндпоинты ПУБЛИЧНЫЕ (cmd/server/main.go:993-994, 1021-1026 — только
 * rate-limit, без auth-middleware), поэтому прокси-роут (как у admin-выгрузок
 * events) не нужен — ссылки ведут напрямую на бек.
 */
export function glossaryExportUrls(
  apiBase: string,
  termId?: string,
): GlossaryExportUrls {
  const base = apiBase.replace(/\/+$/, "");
  const path = termId
    ? `/api/glossary/${encodeURIComponent(termId)}`
    : "/api/glossary";
  return { md: `${base}${path}.md`, txt: `${base}${path}.txt` };
}
