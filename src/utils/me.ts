import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { API_URL } from "@/api/base-url";
import type { components } from "@/api/schema";
import { errors, metrics, M } from "@/services/observability";
import { setServerActor } from "@/services/observability/server";
import { instrumentedFetch } from "@/services/observability/server-fetch";

/**
 * Источник истины о текущем пользователе.
 *
 * Поле `capabilities` — плоский union строк формата `<resource>.<action>`,
 * см. {@link Capability} в `./permissions.ts`. Бэкенд решает, какие капы
 * выдать; фронт лишь читает список.
 */
export interface Me {
  id: string;
  username: string;
  role: components["schemas"]["rbac.Role"];
  status: components["schemas"]["rbac.Status"];
  // Тип capability мы не импортируем сюда, чтобы не было циклической
  // зависимости me.ts ↔ permissions.ts. permissions.ts отвечает за
  // валидацию: `can(me, cap)` принимает `Me | null` и проверяет членство.
  capabilities: string[];
}

export type MaybeMe = Me | null;

interface AuthState {
  me: Me | null;
  /** true ТОЛЬКО когда бэк явно вернул 403 + code "BANNED". */
  banned: boolean;
}

const NO_AUTH: AuthState = { me: null, banned: false };

/**
 * Единый источник: один fetch `/api/me` на запрос (дедуп через React.cache),
 * из него выводятся и `getMe()`, и `getBanSignal()`.
 *
 * - нет токена → гость;
 * - 200 → Me;
 * - 403 + code "BANNED" → { me: null, banned: true } (форс-логаут);
 * - 401 / 404 / прочий 403 → гость (токен отозван/протух — тихая деградация);
 * - 5xx → throw (инцидент, не выгоняем реального пользователя в гостя).
 */
const getAuthState = cache(async (): Promise<AuthState> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    metrics.increment(M.authResolve, { outcome: "guest" });
    return NO_AUTH;
  }

  const res = await instrumentedFetch(
    `${API_URL}/api/me`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
    { surface: "me.resolve" },
  );

  if (res.status === 403) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { code?: string };
      code = body.code;
    } catch {
      // тело не JSON / пустое — трактуем как небанный 403 (обычный гость)
    }
    const banned = code === "BANNED";
    metrics.increment(M.authResolve, { outcome: banned ? "banned" : "guest" });
    return { me: null, banned };
  }
  if (res.status === 401 || res.status === 404) {
    metrics.increment(M.authResolve, { outcome: "guest" });
    return NO_AUTH;
  }
  if (!res.ok) {
    const err = new Error(`getMe(): backend returned ${res.status}`);
    errors.capture(err, { errorClass: "backend.5xx", handled: false });
    throw err;
  }

  const json: unknown = await res.json();
  const candidate =
    typeof json === "object" && json !== null && "data" in json
      ? (json as { data: unknown }).data
      : json;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("id" in candidate) ||
    !("username" in candidate) ||
    !("role" in candidate) ||
    !("status" in candidate) ||
    !("capabilities" in candidate)
  ) {
    const err = new Error("getMe(): backend returned malformed payload");
    errors.capture(err, { errorClass: "unexpected", handled: false, attributes: { reason: "malformed_me_payload" } });
    throw err;
  }

  const me = candidate as Me;
  await setServerActor(me.id, me.role);
  metrics.increment(M.authResolve, {
    outcome: me.status === "active" ? "active" : "suspended",
  });
  return { me, banned: false };
});

/** Текущий пользователь или `null` (гость). Контракт не изменился. */
export const getMe = async (): Promise<MaybeMe> => (await getAuthState()).me;

/** `true`, только если бэк явно вернул бан (403 + code "BANNED") на этом запросе. */
export const getBanSignal = async (): Promise<boolean> =>
  (await getAuthState()).banned;

/**
 * Требует активного пользователя (status === "active").
 * Гость и suspended-пользователь → redirect на /login?next=<nextPath>.
 * Возвращает суженный Me (non-null, status гарантированно "active").
 */
export async function requireActiveUserOrRedirect(nextPath: string): Promise<Me> {
  const me = await getMe();
  if (me?.status !== "active") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  // After the redirect guard, me is non-null and status is "active".
  return me;
}

/**
 * Требует залогиненного пользователя (suspended допустим).
 * Только гость → redirect на /login?next=<nextPath>.
 * Возвращает Me (non-null).
 */
export async function requireUserOrRedirect(nextPath: string): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return me;
}
