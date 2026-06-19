// src/features/auth/actions.ts
"use server";
import "server-only";
import { redirect } from "next/navigation";

import { instrumentedFetch } from "@/services/observability/server-fetch";
import { createFormAction, parseFormData } from "@/utils/create-action";

import { setAuthCookies, clearAuthCookies, getAuthToken, getRefreshToken } from "./cookie";
import { safeNextPath } from "./safe-next";
import { LoginSchema, RegisterSchema } from "./schemas";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Семантическая ошибка auth-flow. `message` — enum-ключ, UI мапит его в
 * брендированный текст. Не наружу слайса.
 */
class AuthError extends Error {
  constructor(kind:
    | "invalid_credentials"
    | "account_blocked"
    | "service_unavailable"
    | "username_taken"
    | "invalid_input"
    | "too_many_requests") {
    super(kind);
    this.name = "AuthError";
  }
}

export const loginAction = createFormAction<undefined>(async (formData) => {
  const { username, password, next } = parseFormData(LoginSchema, formData);

  let res: Response;
  try {
    res = await instrumentedFetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    }, { surface: "auth.login" });
  } catch {
    throw new AuthError("service_unavailable");
  }

  if (res.status === 401) throw new AuthError("invalid_credentials");
  if (res.status === 403) throw new AuthError("account_blocked");
  if (!res.ok) throw new AuthError("service_unavailable");

  let tokens: { access?: string; refresh?: string; expiresIn?: number } = {};
  try {
    const json = (await res.json()) as {
      data?: { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
    };
    const d = json.data ?? {};
    tokens = {
      access: typeof d.access_token === "string" ? d.access_token : undefined,
      refresh: typeof d.refresh_token === "string" ? d.refresh_token : undefined,
      expiresIn: typeof d.expires_in === "number" ? d.expires_in : undefined,
    };
  } catch {
    throw new AuthError("service_unavailable");
  }
  if (!tokens.access || !tokens.refresh) throw new AuthError("service_unavailable");

  await setAuthCookies({ access: tokens.access, refresh: tokens.refresh, expiresIn: tokens.expiresIn });
  redirect(safeNextPath(next));
}, "loginAction");

/**
 * Регистрация. Бек на 201 возвращает user.User БЕЗ токена
 * (philosophy-api/internal/user/handler.go: Register → WriteJSON(201, u)),
 * поэтому автологина нет — редиректим на /login с success-флагом,
 * сохраняя next. 409 = username занят; 400/422 в норме недостижимы
 * (RegisterSchema зеркалит правила бека); 429 = login-rate-limiter.
 */
export const registerAction = createFormAction<undefined>(async (formData) => {
  const { username, password, next } = parseFormData(RegisterSchema, formData);

  let res: Response;
  try {
    res = await instrumentedFetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    }, { surface: "auth.register" });
  } catch {
    throw new AuthError("service_unavailable");
  }

  if (res.status === 409) throw new AuthError("username_taken");
  if (res.status === 400 || res.status === 422) {
    throw new AuthError("invalid_input");
  }
  if (res.status === 429) throw new AuthError("too_many_requests");
  if (!res.ok) throw new AuthError("service_unavailable");

  const safeNext = safeNextPath(next);
  const loginUrl =
    safeNext === "/"
      ? "/login?registered=1"
      : `/login?registered=1&next=${encodeURIComponent(safeNext)}`;
  redirect(loginUrl);
}, "registerAction");

/**
 * Выход с текущего устройства: отзыв ТЕКУЩЕЙ refresh-сессии по токену из cookie.
 * Бэк принимает тело `{ refresh_token }` и инвалидирует только эту сессию.
 *
 * Best-effort: локально разлогиниваем (чистим обе cookie) даже при сбое бэка.
 * Худший случай при сбое: refresh и access живут до своего expiry на сервере.
 * Запрос ограничен таймаутом: зависший бэк не должен держать логаут открытым.
 */
const LOGOUT_TIMEOUT_MS = 3000;

export async function logoutAction(): Promise<void> {
  const refresh = await getRefreshToken();
  if (refresh) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
    try {
      await instrumentedFetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
        signal: controller.signal,
      }, { surface: "auth.logout" });
    } catch {
      // best-effort: сеть / таймаут (AbortError) / любой статус — см. JSDoc выше
    } finally {
      clearTimeout(timer);
    }
  }

  await clearAuthCookies();
  redirect("/");
}

/** Выход со всех устройств: бэк отзывает все сессии + бампит tokens_valid_after
 * (мгновенный kill всего access). Требует валидный access-токен. Best-effort. */
export async function logoutAllAction(): Promise<void> {
  const access = await getAuthToken();
  if (access) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
    try {
      await instrumentedFetch(`${API_URL}/api/auth/logout-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
        signal: controller.signal,
      }, { surface: "auth.logout_all" });
    } catch {
      // best-effort
    } finally {
      clearTimeout(timer);
    }
  }
  await clearAuthCookies();
  redirect("/");
}
