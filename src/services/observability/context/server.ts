// src/services/observability/context/server.ts
import "server-only";

// Серверный контекст наблюдаемости: per-request холдер, мемоизированный React cache().

import { cache } from "react";

import { baseContext, type ContextProvider } from "../core/registry";
import type { ContextSnapshot } from "../core/types";

function resolveEnv(): ContextSnapshot["env"] {
  const raw = process.env.NODE_ENV;
  if (raw === "production") return "production";
  if (raw === "test") return "test";
  return "development";
}

// HMAC-SHA256(id, salt) via Web Crypto (runtime-agnostic), усечённый. Без соли — «anon».
export async function hashActor(id: string): Promise<string> {
  const salt = process.env.OBSERVABILITY_ACTOR_SALT;
  if (!salt) return "anon";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(id));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// Per-request holder. React cache() returns the SAME object within one request,
// so setServerActor/setServerRoute mutations stick for that request; a fresh
// request gets a fresh object (no cross-request leak).
const holder = cache((): ContextSnapshot => ({
  ...baseContext(resolveEnv(), "server"),
  requestId: crypto.randomUUID(),
  release: process.env.OBSERVABILITY_RELEASE ?? null,
}));

export function getServerContext(): ContextSnapshot {
  return holder();
}

export async function setServerActor(id: string, role: string): Promise<void> {
  const ctx = holder();
  ctx.actorHash = await hashActor(id);
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
