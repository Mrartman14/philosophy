// src/services/observability/context/server.ts
import "server-only";

// Серверный контекст наблюдаемости: per-request холдер, мемоизированный React cache().
import { createHmac, randomUUID } from "node:crypto";

import { cache } from "react";

import { baseContext, type ContextProvider } from "../core/registry";
import type { ContextSnapshot } from "../core/types";

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

// Per-request holder. React cache() returns the SAME object within one request,
// so setServerActor/setServerRoute mutations stick for that request; a fresh
// request gets a fresh object (no cross-request leak).
const holder = cache((): ContextSnapshot => ({
  ...baseContext(resolveEnv(), "server"),
  requestId: randomUUID(),
  release: process.env.OBSERVABILITY_RELEASE ?? null,
}));

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
