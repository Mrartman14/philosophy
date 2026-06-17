// src/services/observability/config.ts
// Чтение конфигурации наблюдаемости из process.env. Изоморфно.
import { resolveEnv } from "./core/env";
import type { ContextSnapshot } from "./core/types";

export interface ObservabilityConfig {
  enabled: boolean;
  adapter: "console" | "noop";
  sampleRate: number;
  actorSalt: string | null;
  ingestPath: string;
  env: ContextSnapshot["env"];
}

function bool(raw: string | undefined): boolean {
  return raw === "1" || raw === "true";
}

function adapter(raw: string | undefined): "console" | "noop" {
  return raw === "console" ? "console" : "noop";
}

function rate(raw: string | undefined): number {
  if (raw === undefined) return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1;
}

function orNull(raw: string | undefined): string | null {
  return raw === undefined || raw === "" ? null : raw;
}

export function readServerConfig(): ObservabilityConfig {
  return {
    enabled: bool(process.env.OBSERVABILITY_ENABLED),
    adapter: adapter(process.env.OBSERVABILITY_ADAPTER),
    sampleRate: rate(process.env.OBSERVABILITY_SAMPLE_RATE),
    actorSalt: orNull(process.env.OBSERVABILITY_ACTOR_SALT),
    ingestPath: orNull(process.env.OBSERVABILITY_INGEST_PATH) ?? "/api/telemetry",
    env: resolveEnv(),
  };
}

export function readClientConfig(): ObservabilityConfig {
  return {
    enabled: bool(process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED),
    adapter: adapter(process.env.NEXT_PUBLIC_OBSERVABILITY_ADAPTER),
    sampleRate: rate(process.env.NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE),
    actorSalt: null, // соль никогда не уезжает на клиент
    ingestPath:
      orNull(process.env.NEXT_PUBLIC_OBSERVABILITY_INGEST_PATH) ?? "/api/telemetry",
    env: resolveEnv(),
  };
}
