// Чистые helpers ссылок на выгрузки. Без "server-only": нужны тестам и
// client-компонентам.

export interface ExportUrls {
  md: string;
  txt: string;
}

/**
 * Ссылки на `.md/.txt` через ЛОКАЛЬНЫЙ прокси-роут `/{segment}/{id}/export`
 * (подкладывает Bearer из httpOnly-cookie — см. `@/utils/export-proxy`).
 * Для ресурсов с приватной видимостью у владельца (documents, lectures).
 */
export function proxyExportUrls(segment: string, id: string): ExportUrls {
  const base = `/${segment}/${encodeURIComponent(id)}/export`;
  return { md: `${base}?format=md`, txt: `${base}?format=txt` };
}

/** Срезает завершающие слеши базового URL API/сайта. */
export function trimApiBase(base: string): string {
  return base.replace(/\/+$/, "");
}
