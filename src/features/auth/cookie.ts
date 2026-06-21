import "server-only";
import { cookies } from "next/headers";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_FALLBACK_MAX_AGE,
  REFRESH_MAX_AGE,
  authCookieOptions,
} from "./cookie-config";

/** Кладёт пару токенов в httpOnly-cookie. Access живёт ≈ expires_in (15 мин),
 * refresh — 30 дней. Обе ротируются на каждом refresh (см. src/proxy.ts). */
export async function setAuthCookies(t: {
  access: string;
  refresh: string;
  expiresIn?: number;
}): Promise<void> {
  const store = await cookies();
  const accessMaxAge = t.expiresIn && t.expiresIn > 0 ? t.expiresIn : ACCESS_FALLBACK_MAX_AGE;
  store.set(ACCESS_COOKIE, t.access, authCookieOptions(accessMaxAge));
  store.set(REFRESH_COOKIE, t.refresh, authCookieOptions(REFRESH_MAX_AGE));
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAuthToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}
