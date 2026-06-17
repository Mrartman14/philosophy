// src/services/observability/context/server.ts
import "server-only";

// Серверный контекст наблюдаемости: per-request холдер, мемоизированный React cache().
import { cache } from "react";
import { createHmac, randomUUID } from "node:crypto";

import type { ContextSnapshot } from "../core/types";
import { baseContext, type ContextProvider } from "../core/registry";

function resolveEnv(): ContextSnapshot["env"] {
  const raw = process.env.NODE_ENV;
  if (raw === "production") return "production";
  if (raw === "test") return "test";
  return "development";
}

// HMAC-SHA256(id, salt), усечённый. Без соли — псевдоним «anon».
export function hashActor(id: string): string {
  const salt = process.env.OBSERVABILITY_ACTOR_SALT;
  if (!salt) return "anon";
  return createHmac("sha256", salt).update(id).digest("hex").slice(0, 16);
}

// Держатель per-request контекста. cache() гарантирует один объект на запрос.
// Внутренняя функция самомемоизируется через замыкание: первый вызов строит объект,
// последующие — возвращают тот же. В продакшне cache() сбрасывает замыкание на каждый
// новый запрос; в тестах (cache = identity) работает как модульный синглтон.
const holder = cache(
  (() => {
    let snapshot: ContextSnapshot | undefined;
    return (): ContextSnapshot => {
      if (!snapshot) {
        snapshot = {
          ...baseContext(resolveEnv(), "server"),
          requestId: randomUUID(),
          release: process.env.OBSERVABILITY_RELEASE ?? null,
        };
      }
      return snapshot;
    };
  })(),
);

export function getServerContext(): ContextSnapshot {
  return holder();
}

export function setServerActor(id: string, role: string): void {
  const ctx = holder();
  ctx.actorHash = hashActor(id);
  ctx.actorRole = role;
}

export function setServerRoute(route: string): void {
  holder().route = route;
}

export const serverContextProvider: ContextProvider = {
  getContext: (): ContextSnapshot => {
    try {
      return getServerContext();
    } catch {
      // Вне React-скоупа (out-of-request) — безопасный fallback.
      return baseContext(resolveEnv(), "server");
    }
  },
};
