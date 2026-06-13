// src/features/lectures/export-urls.ts
// Чистый helper ссылок на прокси-выгрузки лекции. Без "server-only" — нужен
// тестам. Паттерн — src/features/documents/export-urls.ts.

export interface LectureExportUrls {
  md: string;
  txt: string;
}

/**
 * Ссылки на .md/.txt лекции ведут на ЛОКАЛЬНЫЙ прокси-роут
 * /lectures/{id}/export, который подкладывает Bearer из httpOnly-cookie.
 * Эндпоинты бека (GET /api/lectures/{id}.md|.txt) — optionalAuth: публичная
 * лекция доступна без токена, но приватная лекция владельца при браузерной
 * навигации без токена вернула бы 401. Прокси решает оба случая.
 */
export function lectureExportUrls(id: string): LectureExportUrls {
  const base = `/lectures/${encodeURIComponent(id)}/export`;
  return { md: `${base}?format=md`, txt: `${base}?format=txt` };
}
