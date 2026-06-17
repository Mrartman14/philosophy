// src/services/observability/core/env.ts
// Единая точка резолва NODE_ENV → ContextSnapshot["env"]. Изоморфна.
import type { ContextSnapshot } from "./types";

export function resolveEnv(): ContextSnapshot["env"] {
  const raw = process.env.NODE_ENV;
  if (raw === "production") return "production";
  if (raw === "test") return "test";
  return "development";
}
