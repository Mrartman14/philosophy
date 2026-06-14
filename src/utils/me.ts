import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { components } from "@/api/schema";

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

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Возвращает текущего пользователя или `null` (гость).
 *
 * Различает три случая:
 * 1. Нет токена → `null` (гость, тихая деградация).
 * 2. Токен есть, ответ `401` (токен невалиден / истёк) → `null` (тоже гость).
 * 3. Токен есть, бэк не ответил / 5xx → `throw` (пусть error.tsx покажется,
 *    мы не должны молча выгонять реального пользователя в гостя).
 *
 * Кейс #3 критичен для admin layout'а: если бы `getMe` глотал 5xx и
 * возвращал `null`, админа выкинуло бы на 403 при любом мигании бэка.
 *
 * Дедуплицируется через `React.cache()` в рамках одного запроса.
 */
export const getMe = cache(async (): Promise<MaybeMe> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const res = await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403 || res.status === 404) {
    // Токен есть, но бэк его не принял — обычный «истёк / отозван».
    return null;
  }
  if (!res.ok) {
    // 5xx / неожиданное — это инцидент, не «гость». Бросаем,
    // ближайший error.tsx покажет пользователю фолбэк.
    throw new Error(`getMe(): backend returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: unknown };
  const candidate =
    typeof json === "object" && json !== null && "data" in json
      ? (json as { data: unknown }).data
      : json;

  // Минимальная валидация формы — без неё `as Me` — это ложь.
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("id" in candidate) ||
    !("username" in candidate) ||
    !("role" in candidate) ||
    !("status" in candidate) ||
    !("capabilities" in candidate)
  ) {
    throw new Error("getMe(): backend returned malformed payload");
  }

  return candidate as Me;
});
