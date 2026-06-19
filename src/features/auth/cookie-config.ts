// Client-safe (без "server-only"): импортируется и из server-only cookie.ts,
// и из src/middleware.ts. Единый источник имён cookie и их max-age, чтобы
// actions и middleware не разъезжались.

/** Access-JWT (короткий, ≈ expires_in c бэка). */
export const ACCESS_COOKIE = "token";
/** Непрозрачный refresh-токен (длинный, ротируется). */
export const REFRESH_COOKIE = "refresh_token";

/** Фолбэк max-age access-cookie, если бэк не прислал expires_in (access TTL = 900с). */
export const ACCESS_FALLBACK_MAX_AGE = 15 * 60;
/** Max-age refresh-cookie ≈ refresh absolute TTL бэка (30 дней). */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
