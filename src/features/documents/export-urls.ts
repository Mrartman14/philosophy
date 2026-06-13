// src/features/documents/export-urls.ts
// Чистый helper построения ссылок на прокси-выгрузки документа.
// Без "server-only": нужен тестам. Паттерн — src/features/events/calendar.ts.

export interface DocumentExportUrls {
  md: string;
  txt: string;
}

/**
 * Ссылки на .md/.txt документа ведут на ЛОКАЛЬНЫЙ прокси-роут
 * /documents/{id}/export, который подкладывает Bearer-токен из httpOnly-cookie
 * (эндпоинты бека optionalAuth — приватный документ владельца без токена
 * получил бы 401 при браузерной навигации). Паттерн — events export route.
 */
export function documentExportUrls(id: string): DocumentExportUrls {
  const base = `/documents/${encodeURIComponent(id)}/export`;
  return { md: `${base}?format=md`, txt: `${base}?format=txt` };
}
