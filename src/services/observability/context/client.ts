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

// Вызывается из ClientContextReporter (монтируется в root-layout): хеш актора
// приходит уже посчитанным с сервера — сырой id на клиент не уходит.
export function setClientActor(hash: string, role: string): void {
  ctx.actorHash = hash;
  ctx.actorRole = role;
}

// Вызывается из ClientContextReporter через usePathname + useEffect, чтобы смена
// маршрута на клиенте отражалась в телеметрии.
export function setClientRoute(route: string): void {
  ctx.route = route;
}

export const clientContextProvider: ContextProvider = {
  getContext: (): ContextSnapshot => ctx,
};
