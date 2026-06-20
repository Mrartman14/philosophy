// src/security/security-headers.ts
// Статические security-заголовки (не зависят от запроса). Применяются глобально
// через next.config.ts headers().
// HSTS здесь НЕ ставим: на проде edge — nginx (philosophy-api/nginx/tls.conf) —
// уже шлёт Strict-Transport-Security (2 года). Дубль из app перебил бы её более
// коротким max-age (браузер берёт первый заголовок) → единственный владелец HSTS — edge.
export interface HeaderKV {
  key: string;
  value: string;
}

export function staticSecurityHeaders(): HeaderKV[] {
  return [
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
}
