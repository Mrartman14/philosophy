// src/features/auth/actions.ts
"use server";
import "server-only";
import { redirect } from "next/navigation";

import { createFormAction, parseFormData } from "@/utils/create-action";

import { setAuthCookie, clearAuthCookie, getAuthToken } from "./cookie";
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
    res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch {
    throw new AuthError("service_unavailable");
  }

  if (res.status === 401) throw new AuthError("invalid_credentials");
  if (res.status === 403) throw new AuthError("account_blocked");
  if (!res.ok) throw new AuthError("service_unavailable");

  let token: string | undefined;
  try {
    const json = (await res.json()) as { data?: { token?: unknown } };
    if (typeof json.data?.token === "string") token = json.data.token;
  } catch {
    throw new AuthError("service_unavailable");
  }
  if (!token) throw new AuthError("service_unavailable");

  await setAuthCookie(token);
  redirect(safeNextPath(next));
});

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
    res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
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
});

/**
 * Выход. Дёргает `POST /api/auth/logout` (бэк отзывает ВСЕ токены пользователя,
 * logout-everywhere; идемпотентно), затем чистит локальную cookie и редиректит.
 *
 * Вызов бэка — best-effort: логаут ОБЯЗАН разлогинить локально даже если бэк
 * недоступен или ответил ошибкой, иначе сетевой сбой запер бы пользователя в
 * сессии. 401/403 для логаута неактуальны (токен и так невалиден), показывать
 * нечего — поэтому ошибки/таймаут глотаем. Худший случай при сбое: токен живёт
 * до своего expiry на сервере — не хуже прежнего поведения (бэк не звался вовсе).
 */
export async function logoutAction(): Promise<void> {
  const token = await getAuthToken();
  if (token) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      // best-effort: см. JSDoc выше
    }
  }

  await clearAuthCookie();
  redirect("/");
}
