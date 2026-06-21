// src/services/observability/context/server.ts
import "server-only";

// Серверный контекст наблюдаемости: per-request холдер, мемоизированный React cache().

import { cache } from "react";

import { readServerConfig } from "../config";
import { resolveEnv } from "../core/env";
import { baseContext, type ContextProvider } from "../core/registry";
import type { ContextSnapshot } from "../core/types";

// HMAC-SHA256(id, salt) via Web Crypto (runtime-agnostic), усечённый. Без соли — «anon».
export async function hashActor(id: string, salt: string | null): Promise<string> {
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

// Хешированный актор для прокидывания на клиент (raw id на клиент НЕ уходит).
// null для гостя — setServerActor ещё не вызывался в этом запросе.
export function getActorContext(): { hash: string; role: string } | null {
  const ctx = holder();
  if (!ctx.actorHash) return null;
  return { hash: ctx.actorHash, role: ctx.actorRole ?? "" };
}

export async function setServerActor(id: string, role: string): Promise<void> {
  const cfg = readServerConfig();
  const ctx = holder();
  ctx.actorHash = await hashActor(id, cfg.actorSalt);
  ctx.actorRole = role;
}

// Вызывается из root-layout: путь приходит из request-заголовка x-pathname,
// который ставит middleware (src/proxy.ts), и попадает в каждую серверную
// телеметрию этого запроса.
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
