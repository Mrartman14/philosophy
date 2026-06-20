// src/seo/site-url.ts
// Единый источник базового абсолютного URL для SEO (robots/canonical/OG).
// База — NEXT_PUBLIC_BASE_URL (в проде корень origin; github.io/basePath — мёртвая
// легаси). Значение вшивается build-time; перед раскаткой SEO должно быть реальным origin.
// Пустое/неустановленное → дефолт для dev (порт dev-сервера проекта — 3001).
const DEFAULT_BASE = "http://localhost:3001";

function rawBase(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return configured && configured.length > 0 ? configured : DEFAULT_BASE;
}

export function siteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? rawBase() : `${rawBase()}${normalized}`;
}

export function metadataBaseUrl(): URL {
  return new URL(rawBase());
}
