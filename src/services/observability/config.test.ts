// src/services/observability/config.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { readClientConfig, readServerConfig } from "./config";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("readServerConfig", () => {
  it("дефолты: noop-adapter, выключено вне prod, sampleRate=1", () => {
    vi.stubEnv("NODE_ENV", "test");
    const cfg = readServerConfig();
    expect(cfg.adapter).toBe("noop");
    expect(cfg.enabled).toBe(false);
    expect(cfg.sampleRate).toBe(1);
    expect(cfg.env).toBe("test");
    expect(cfg.ingestPath).toBe("/api/telemetry");
    expect(cfg.actorSalt).toBeNull();
    expect(cfg.release).toBeNull();
  });

  it("OBSERVABILITY_* переключают adapter/enabled/sampleRate/salt/release", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OBSERVABILITY_ENABLED", "1");
    vi.stubEnv("OBSERVABILITY_ADAPTER", "console");
    vi.stubEnv("OBSERVABILITY_SAMPLE_RATE", "0.25");
    vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
    vi.stubEnv("OBSERVABILITY_RELEASE", "v9");
    vi.stubEnv("OBSERVABILITY_INGEST_PATH", "/ingest");
    const cfg = readServerConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.adapter).toBe("console");
    expect(cfg.sampleRate).toBe(0.25);
    expect(cfg.actorSalt).toBe("pepper");
    expect(cfg.release).toBe("v9");
    expect(cfg.env).toBe("production");
    expect(cfg.ingestPath).toBe("/ingest");
  });

  it("битый sampleRate → fallback 1", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("OBSERVABILITY_SAMPLE_RATE", "nope");
    expect(readServerConfig().sampleRate).toBe(1);
  });
});

describe("readClientConfig", () => {
  it("дефолты: noop, clientEnabled=false, release из NEXT_PUBLIC_RELEASE", () => {
    vi.stubEnv("NODE_ENV", "production");
    const cfg = readClientConfig();
    expect(cfg.adapter).toBe("noop");
    expect(cfg.enabled).toBe(false);
    expect(cfg.clientEnabled).toBe(false);
    expect(cfg.release).toBeNull();
    expect(cfg.actorSalt).toBeNull();
  });

  it("NEXT_PUBLIC_OBSERVABILITY_* включают клиент", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ADAPTER", "console");
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE", "0.5");
    vi.stubEnv("NEXT_PUBLIC_RELEASE", "c1");
    const cfg = readClientConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.clientEnabled).toBe(true);
    expect(cfg.adapter).toBe("console");
    expect(cfg.sampleRate).toBe(0.5);
    expect(cfg.release).toBe("c1");
  });
});
