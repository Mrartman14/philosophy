// src/security/security-headers.ts
// Статические security-заголовки (не зависят от запроса). Применяются глобально
// через next.config.ts headers(). HSTS — только в проде, без preload (необратимо).
export interface HeaderKV {
  key: string;
  value: string;
}

export function staticSecurityHeaders(isProd: boolean): HeaderKV[] {
  const headers: HeaderKV[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), browsing-topics=(), " +
        "payment=(), usb=(), serial=(), bluetooth=(), hid=(), " +
        "accelerometer=(), gyroscope=(), magnetometer=(), " +
        "xr-spatial-tracking=(), display-capture=(), idle-detection=()",
    },
  ];
  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}
