// src/security/csp.ts
// Чистые билдеры Content-Security-Policy. Side-effect'ы только в generateNonce
// (Web Crypto) и buildSecurityHeaders (читает env). Обоснование политики —
// docs/superpowers/specs/2026-06-20-csp-security-headers-design.md
export interface CspParams {
  nonce: string;
  apiOrigin: string | null;
  storageOrigin: string | null;
  isDev: boolean;
}

export interface SecurityHeaders {
  nonce: string;
  /** Значение политики (одинаково для request и response). */
  csp: string;
  /** Имя заголовка ответа: enforce vs report-only. */
  responseHeaderName: string;
}

export function originFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function cspHeaderName(enforce: boolean): string {
  return enforce
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

export function buildCsp({
  nonce,
  apiOrigin,
  storageOrigin,
  isDev,
}: CspParams): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ];
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    ...(storageOrigin ? [storageOrigin] : []),
  ];
  const externalOrigins = [apiOrigin, storageOrigin].filter(
    (o): o is string => o !== null,
  );
  const connectSrc = [
    "'self'",
    ...new Set(externalOrigins),
    ...(isDev ? ["ws:"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildSecurityHeaders(): SecurityHeaders {
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    apiOrigin: originFromUrl(process.env.NEXT_PUBLIC_API_URL),
    // storage резолвится ТАК ЖЕ, как в src/utils/storage-url.ts: STORAGE || API.
    // ВАЖНО: эти переменные должны быть заданы перед CSP_ENFORCE=1, иначе
    // cross-origin картинки/запросы заблокируются (см. .env.example, Task 6).
    storageOrigin:
      originFromUrl(process.env.NEXT_PUBLIC_STORAGE_URL) ??
      originFromUrl(process.env.NEXT_PUBLIC_API_URL),
    isDev: process.env.NODE_ENV !== "production",
  });
  return {
    nonce,
    csp,
    responseHeaderName: cspHeaderName(process.env.CSP_ENFORCE === "1"),
  };
}
