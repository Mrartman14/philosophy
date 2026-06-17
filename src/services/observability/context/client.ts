// src/services/observability/context/client.ts
// Клиентский контекст: модульный синглтон на загрузку страницы. Без server-only.
import { resolveEnv } from "../core/env";
import { baseContext, type ContextProvider } from "../core/registry";
import type { ContextSnapshot } from "../core/types";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initialRoute(): string | null {
  return typeof location !== "undefined" ? location.pathname : null;
}

// Один контекст на загрузку страницы.
const ctx: ContextSnapshot = {
  ...baseContext(resolveEnv(), "client"),
  sessionId: newSessionId(),
  route: initialRoute(),
  release: process.env.NEXT_PUBLIC_RELEASE ?? null,
};

export function getClientContext(): ContextSnapshot {
  return ctx;
}

// TODO(obs/routing): wire setClientActor from a session-resolved provider (e.g. a
// client component that receives the hashed actor from the server) so that actor
// context is populated for all client-side telemetry. See SW-deferral pattern.
export function setClientActor(hash: string, role: string): void {
  ctx.actorHash = hash;
  ctx.actorRole = role;
}

// TODO(obs/routing): wire setClientRoute via usePathname + useEffect in a root
// client component so that route changes are reflected in telemetry records.
// See SW-deferral pattern.
export function setClientRoute(route: string): void {
  ctx.route = route;
}

export const clientContextProvider: ContextProvider = {
  getContext: (): ContextSnapshot => ctx,
};
