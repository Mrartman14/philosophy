# Observability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vendor-neutral observability layer (logging + error-handling + metrics) for the Next.js 16 SSR frontend, wired at central seams so feature code stays untouched.

**Architecture:** Ports & adapters. Three consumer ports (Logger / ErrorReporter / Metrics) + one provider port (ObservabilitySink) behind a registry. Server request context via React `cache()`; client context via a module singleton. `console` + `noop` + `memory` adapters ship now; OTLP/Sentry/OTel are future drop-in adapters. Instrumentation lives at the seams (createAction, openapi-fetch middleware, a shared raw-fetch wrapper, me/permissions/revalidate, instrumentation\*.ts, error boundaries, offline drain) plus a `/api/telemetry` ingest route for client beacons that converges on the same server sink.

**Tech Stack:** Next.js 16.1.4 App Router (Node runtime), React 19.2.3, TypeScript ^6 (strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`), Vitest 4 (globals:false, jsdom), pnpm 8.14.3.

**Spec:** [docs/superpowers/specs/2026-06-17-observability-foundation-design.md](../specs/2026-06-17-observability-foundation-design.md)

## Global Constraints

- **pnpm only** (npm/yarn break the toolchain). Quality gate `pnpm lint && pnpm test && pnpm build` must stay green before each phase lands.
- **TS strict:** model "absent" RECORD/CONTEXT fields as `| null`, NOT optional `?`. Optional consumer-port input params stay `?:`.
- **server-only** modules begin with `import "server-only";` (Vitest aliases it to a no-op stub — no per-test mock needed).
- **Vitest globals:false** → every test starts with `import { describe, it, expect, vi, beforeEach } from "vitest";`. RTL needs manual `afterEach(cleanup)` (auto-cleanup is OFF).
- **Coverage thresholds (keep green):** statements 41 / branches 30 / functions 40 / lines 42. Colocate `*.test.ts(x)`.
- **Parallel-agent git rules (CLAUDE.md):** NO destructive git (`stash`/`reset`/`checkout .`/`clean`), NO `git add -A`/`git add .` — add only the task's own files by name. NO `git push`.
- **This is the sanctioned foundation PR** — frozen-zone touches are expected: `src/utils/{create-action,api-error,me,permissions,revalidate}.ts`, `src/api/client.ts`, `eslint.config.mjs`, `.env.example`, new `instrumentation*.ts`, new `src/services/observability/`, new `src/app/api/telemetry/`.
- **ESLint guards G1–G4 stay.** Observability is consumed via its barrels: `@/services/observability` (server) and `@/services/observability/client` (client-safe).
- **Privacy invariant:** anonymized actor hash only; raw `id`/`username`/`email` never leave the process; request bodies and field VALUES always redacted. `actorRole` is kept (low-cardinality, non-identifying).
- **Commit messages:** conventional commits, scope `observability` (or `obs`); end every body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Core Contract (Phase 0 defines these exact symbols; Phases 1–4 consume them)

Module root `src/services/observability/` (mirrors `src/services/offline/`). Consumer ports and the provider port:

```ts
// core/types.ts (isomorphic)
type Attributes = Record<string, string | number | boolean | null>;
type Level = "debug" | "info" | "warn" | "error";
type Runtime = "server" | "client" | "sw";
type ErrorClass =
  | "forbidden.role" | "forbidden.status" | "forbidden.owner" | "forbidden.guest"
  | "validation" | "banned" | "conflict.version" | "conflict.idempotency"
  | "rate_limited" | "not_found" | "backend.5xx" | "network" | "unexpected";
interface ContextSnapshot { env; runtime; release; requestId; sessionId; route; actorHash; actorRole; } // all "absent" fields | null
interface LogRecord    { kind:"log"; level; message; attributes; context; timestamp; }
interface ErrorRecord  { kind:"error"; errorClass; message; backendCode; fingerprint; handled; cause; attributes; context; timestamp; }
interface MetricRecord { kind:"metric"; metric; metricKind:"counter"|"histogram"; value; unit; attributes; context; timestamp; }
type ObservabilityRecord = LogRecord | ErrorRecord | MetricRecord;

// core/ports.ts (isomorphic)
interface Logger { debug/info/warn/error(m: string, a?: Attributes): void; }
interface CaptureOptions { errorClass?: ErrorClass; backendCode?: string; handled?: boolean; attributes?: Attributes; }
interface ErrorReporter { capture(error: unknown, options?: CaptureOptions): void; }
type EndTimer = (extra?: Attributes) => void;
interface Metrics { increment(metric, attrs?, value?): void; histogram(metric, value, attrs?): void; startTimer(metric, attrs?): EndTimer; }
interface ObservabilitySink { readonly name: string; emit(record: ObservabilityRecord): void; flush?(): Promise<void>; } // switch on record.kind

// core/registry.ts — baseContext(env,runtime); setSink/getSink; setContextProvider/getContext; ContextProvider{getContext()}
// core/names.ts — M.{actionDuration,actionCompleted,backendError,apiDuration,apiError,authResolve,rbacDenied,mutationCommit,offlineDrain,offlineQueueDepth,offlineCommandPoison}; webVital(name)
// core/redact.ts — DENY_KEY_PATTERNS; redactAttributes(attrs) (pure, no crypto)
// core/taxonomy.ts — classifyError(error): { errorClass, backendCode } (duck-typed; NO @/utils imports → no cycle)
// core/facade.ts — log/errors/metrics (stamp context+timestamp, redact, sample; errors always emitted)
// config.ts — ObservabilityConfig; readServerConfig(); readClientConfig()
// adapters/ — noopSink; createMemorySink(); createConsoleSink(cfg) [server-only]; createBeaconSink(cfg) [client]
// context/server.ts [server-only] — hashActor(id); getServerContext(); setServerActor(id,role); setServerRoute(route); serverContextProvider
// context/client.ts — getClientContext(); setClientActor(hash,role); setClientRoute(route); clientContextProvider
// index.ts [server-only barrel] — { log, errors, metrics }, types, M, webVital, setServerActor, setServerRoute, initServerObservability()
// client.ts [client-safe barrel] — { log, errors, metrics }, types, M, webVital, setClientActor, setClientRoute, initClientObservability()
```

---

## Phase 0: Core observability module

**Goal:** Build the entire `src/services/observability/` module per the LOCKED CONTRACT as a pure addition — every contract symbol defined and unit-tested, with zero changes to existing seams or behavior.

### Task 0.1: Isomorphic types + record factory

**Files:**
- Create `src/services/observability/core/types.ts`
- Create `src/services/observability/core/types.test.ts`

**Interfaces:**
- Produces: `Attributes`, `Level`, `Runtime`, `ErrorClass`, `ContextSnapshot`, `LogRecord`, `ErrorRecord`, `MetricRecord`, `ObservabilityRecord` (all exported types per contract).

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/core/types.test.ts`:
  ```ts
  // src/services/observability/core/types.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import type {
    Attributes,
    ContextSnapshot,
    ErrorRecord,
    LogRecord,
    MetricRecord,
    ObservabilityRecord,
  } from "./types";

  // Контекст-фикстура: «отсутствие» полей моделируется как null (exactOptionalPropertyTypes).
  const ctx: ContextSnapshot = {
    env: "test",
    runtime: "server",
    release: null,
    requestId: null,
    sessionId: null,
    route: null,
    actorHash: null,
    actorRole: null,
  };

  describe("observability record types", () => {
    it("LogRecord конформен контракту", () => {
      const attrs: Attributes = { a: 1, b: "x", c: true, d: null };
      const rec: LogRecord = {
        kind: "log",
        level: "info",
        message: "hi",
        attributes: attrs,
        context: ctx,
        timestamp: 0,
      };
      expect(rec.kind).toBe("log");
      expect(rec.attributes.d).toBeNull();
    });

    it("ErrorRecord несёт классификацию и cause", () => {
      const rec: ErrorRecord = {
        kind: "error",
        errorClass: "network",
        message: "fetch failed",
        backendCode: null,
        fingerprint: null,
        handled: true,
        cause: { name: "TypeError", message: "fetch failed", stack: null },
        attributes: {},
        context: ctx,
        timestamp: 0,
      };
      expect(rec.errorClass).toBe("network");
      expect(rec.cause?.name).toBe("TypeError");
    });

    it("MetricRecord различает counter/histogram", () => {
      const rec: MetricRecord = {
        kind: "metric",
        metric: "action.duration",
        metricKind: "histogram",
        value: 12,
        unit: "ms",
        attributes: {},
        context: ctx,
        timestamp: 0,
      };
      expect(rec.metricKind).toBe("histogram");
      expect(rec.unit).toBe("ms");
    });

    it("ObservabilityRecord — дискриминированный union по kind", () => {
      const recs: ObservabilityRecord[] = [
        { kind: "log", level: "debug", message: "m", attributes: {}, context: ctx, timestamp: 1 },
      ];
      const r = recs[0];
      expect(r).toBeDefined();
      expect(r?.kind).toBe("log");
    });
  });

  // beforeEach/vi импортированы для единообразия test-преамбулы (globals:false).
  beforeEach(() => {
    vi.clearAllMocks();
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/core/types.test.ts`. Expect failure: `Cannot find module './types'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/core/types.ts`:
  ```ts
  // src/services/observability/core/types.ts
  // Изоморфные типы наблюдаемости. НЕТ 'server-only' — общий для server/client/sw.
  // «Отсутствие» поля моделируется как `| null` (exactOptionalPropertyTypes).

  export type Attributes = Record<string, string | number | boolean | null>;

  export type Level = "debug" | "info" | "warn" | "error";

  export type Runtime = "server" | "client" | "sw";

  export type ErrorClass =
    | "forbidden.role"
    | "forbidden.status"
    | "forbidden.owner"
    | "forbidden.guest"
    | "validation"
    | "banned"
    | "conflict.version"
    | "conflict.idempotency"
    | "rate_limited"
    | "not_found"
    | "backend.5xx"
    | "network"
    | "unexpected";

  export interface ContextSnapshot {
    env: "development" | "production" | "test";
    runtime: Runtime;
    release: string | null;
    requestId: string | null; // server, на запрос
    sessionId: string | null; // client, на загрузку страницы
    route: string | null;
    actorHash: string | null; // псевдоним; никогда не сырой id
    actorRole: string | null;
  }

  export interface LogRecord {
    kind: "log";
    level: Level;
    message: string;
    attributes: Attributes;
    context: ContextSnapshot;
    timestamp: number;
  }

  export interface ErrorRecord {
    kind: "error";
    errorClass: ErrorClass;
    message: string;
    backendCode: string | null;
    fingerprint: string | null;
    handled: boolean;
    cause: { name: string; message: string; stack: string | null } | null;
    attributes: Attributes;
    context: ContextSnapshot;
    timestamp: number;
  }

  export interface MetricRecord {
    kind: "metric";
    metric: string;
    metricKind: "counter" | "histogram";
    value: number;
    unit: "ms" | "count" | null;
    attributes: Attributes;
    context: ContextSnapshot;
    timestamp: number;
  }

  export type ObservabilityRecord = LogRecord | ErrorRecord | MetricRecord;
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/core/types.test.ts`. Expect all 4 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/core/types.ts src/services/observability/core/types.test.ts && git commit -m "$(printf 'feat(observability): isomorphic record types\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.2: Metric/event name constants

**Files:**
- Create `src/services/observability/core/names.ts`
- Create `src/services/observability/core/names.test.ts`

**Interfaces:**
- Produces: `M` (const record of metric names), `webVital(name: string): string`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/core/names.test.ts`:
  ```ts
  // src/services/observability/core/names.test.ts
  import { describe, it, expect } from "vitest";

  import { M, webVital } from "./names";

  describe("observability names", () => {
    it("M содержит стабильные имена метрик", () => {
      expect(M.actionDuration).toBe("action.duration");
      expect(M.actionCompleted).toBe("action.completed");
      expect(M.backendError).toBe("backend.error");
      expect(M.apiDuration).toBe("api.request.duration");
      expect(M.apiError).toBe("api.request.error");
      expect(M.authResolve).toBe("auth.resolve");
      expect(M.rbacDenied).toBe("rbac.denied");
      expect(M.mutationCommit).toBe("mutation.commit");
      expect(M.offlineDrain).toBe("offline.drain");
      expect(M.offlineQueueDepth).toBe("offline.queue.depth");
      expect(M.offlineCommandPoison).toBe("offline.command.poison");
    });

    it("webVital префиксует имя метрики web_vitals.", () => {
      expect(webVital("LCP")).toBe("web_vitals.LCP");
      expect(webVital("CLS")).toBe("web_vitals.CLS");
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/core/names.test.ts`. Expect failure: `Cannot find module './names'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/core/names.ts`:
  ```ts
  // src/services/observability/core/names.ts
  // Константы имён метрик/событий — единый словарь, чтобы не плодить опечатки на швах.
  export const M = {
    actionDuration: "action.duration",
    actionCompleted: "action.completed",
    backendError: "backend.error",
    apiDuration: "api.request.duration",
    apiError: "api.request.error",
    authResolve: "auth.resolve",
    rbacDenied: "rbac.denied",
    mutationCommit: "mutation.commit",
    offlineDrain: "offline.drain",
    offlineQueueDepth: "offline.queue.depth",
    offlineCommandPoison: "offline.command.poison",
  } as const;

  export const webVital = (name: string): string => `web_vitals.${name}`;
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/core/names.test.ts`. Expect both tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/core/names.ts src/services/observability/core/names.test.ts && git commit -m "$(printf 'feat(observability): metric/event name constants\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.3: Registry — sink + context provider + baseContext

**Files:**
- Create `src/services/observability/core/registry.ts`
- Create `src/services/observability/core/registry.test.ts`

**Interfaces:**
- Consumes: `ContextSnapshot` from `./types`; `ObservabilitySink` from `./ports` (defined in Task 0.4 — implement ports FIRST as a co-task dependency; see note in Step 3).
- Produces: `ContextProvider`, `baseContext(env, runtime)`, `setSink/getSink`, `setContextProvider/getContext`.

> Dependency note: `registry.ts` imports `ObservabilitySink` (a TYPE) from `./ports`. Create `src/services/observability/core/ports.ts` in Step 3 of THIS task as a prerequisite type-only module (no test of its own — it is type-only and exercised by Task 0.6 facade tests).

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/core/registry.test.ts`:
  ```ts
  // src/services/observability/core/registry.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import type { ObservabilityRecord } from "./types";
  import type { ObservabilitySink } from "./ports";
  import {
    baseContext,
    getContext,
    getSink,
    setContextProvider,
    setSink,
    type ContextProvider,
  } from "./registry";

  function makeSink(): ObservabilitySink {
    const records: ObservabilityRecord[] = [];
    return {
      name: "test",
      emit: (r) => {
        records.push(r);
      },
    };
  }

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("baseContext", () => {
    it("строит контекст-заглушку с null-полями", () => {
      const ctx = baseContext("test", "server");
      expect(ctx).toEqual({
        env: "test",
        runtime: "server",
        release: null,
        requestId: null,
        sessionId: null,
        route: null,
        actorHash: null,
        actorRole: null,
      });
    });
  });

  describe("sink registry", () => {
    it("по умолчанию getSink() безопасен (no-op emit не бросает)", () => {
      const sink = getSink();
      expect(() =>
        sink.emit({
          kind: "log",
          level: "info",
          message: "m",
          attributes: {},
          context: baseContext("test", "server"),
          timestamp: 0,
        }),
      ).not.toThrow();
      expect(typeof sink.name).toBe("string");
    });

    it("setSink → getSink возвращает установленный sink", () => {
      const s = makeSink();
      setSink(s);
      expect(getSink()).toBe(s);
    });
  });

  describe("context provider registry", () => {
    it("дефолтный провайдер отдаёт server-baseContext", () => {
      const ctx = getContext();
      expect(ctx.runtime).toBe("server");
      expect(ctx.env).toBeDefined();
    });

    it("setContextProvider подменяет источник контекста", () => {
      const provider: ContextProvider = {
        getContext: () => ({
          ...baseContext("production", "client"),
          requestId: "req-1",
        }),
      };
      setContextProvider(provider);
      expect(getContext().requestId).toBe("req-1");
      expect(getContext().runtime).toBe("client");
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/core/registry.test.ts`. Expect failure: `Cannot find module './ports'` (or `./registry`).
- [ ] **Step 3: Minimal implementation.** First create the prerequisite `src/services/observability/core/ports.ts`:
  ```ts
  // src/services/observability/core/ports.ts
  // Изоморфные порты-потребители наблюдаемости.
  import type { Attributes, ErrorClass, ObservabilityRecord } from "./types";

  export interface Logger {
    debug(m: string, a?: Attributes): void;
    info(m: string, a?: Attributes): void;
    warn(m: string, a?: Attributes): void;
    error(m: string, a?: Attributes): void;
  }

  export interface CaptureOptions {
    errorClass?: ErrorClass;
    backendCode?: string;
    handled?: boolean;
    attributes?: Attributes;
  }

  export interface ErrorReporter {
    capture(error: unknown, options?: CaptureOptions): void;
  }

  export type EndTimer = (extra?: Attributes) => void;

  export interface Metrics {
    increment(metric: string, attributes?: Attributes, value?: number): void;
    histogram(metric: string, value: number, attributes?: Attributes): void;
    startTimer(metric: string, attributes?: Attributes): EndTimer;
  }

  export interface ObservabilitySink {
    readonly name: string;
    emit(record: ObservabilityRecord): void;
    flush?(): Promise<void>;
  }
  ```
  Then create `src/services/observability/core/registry.ts`:
  ```ts
  // src/services/observability/core/registry.ts
  // Реестр активного sink и провайдера контекста. Изоморфный модуль-синглтон.
  import type { ContextSnapshot } from "./types";
  import type { ObservabilitySink } from "./ports";

  export interface ContextProvider {
    getContext(): ContextSnapshot;
  }

  export function baseContext(
    env: ContextSnapshot["env"],
    runtime: ContextSnapshot["runtime"],
  ): ContextSnapshot {
    return {
      env,
      runtime,
      release: null,
      requestId: null,
      sessionId: null,
      route: null,
      actorHash: null,
      actorRole: null,
    };
  }

  // Резолв env из NODE_ENV без сужения к строковым литералам кодом снаружи.
  function resolveEnv(): ContextSnapshot["env"] {
    const raw = process.env.NODE_ENV;
    if (raw === "production") return "production";
    if (raw === "test") return "test";
    return "development";
  }

  // Дефолтный sink — безопасный no-op (до initServer/Client он не должен бросать).
  const defaultSink: ObservabilitySink = {
    name: "noop",
    emit: () => {},
  };

  const defaultProvider: ContextProvider = {
    getContext: () => baseContext(resolveEnv(), "server"),
  };

  let activeSink: ObservabilitySink = defaultSink;
  let activeProvider: ContextProvider = defaultProvider;

  export function setSink(sink: ObservabilitySink): void {
    activeSink = sink;
  }

  export function getSink(): ObservabilitySink {
    return activeSink;
  }

  export function setContextProvider(p: ContextProvider): void {
    activeProvider = p;
  }

  export function getContext(): ContextSnapshot {
    return activeProvider.getContext();
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/core/registry.test.ts`. Expect all 6 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/core/ports.ts src/services/observability/core/registry.ts src/services/observability/core/registry.test.ts && git commit -m "$(printf 'feat(observability): ports + sink/context registry\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.4: Config readers over env

**Files:**
- Create `src/services/observability/config.ts`
- Create `src/services/observability/config.test.ts`

**Interfaces:**
- Consumes: `ContextSnapshot` from `./core/types`.
- Produces: `ObservabilityConfig`, `readServerConfig()`, `readClientConfig()`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/config.test.ts`:
  ```ts
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
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/config.test.ts`. Expect failure: `Cannot find module './config'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/config.ts`:
  ```ts
  // src/services/observability/config.ts
  // Чтение конфигурации наблюдаемости из process.env. Изоморфно.
  import type { ContextSnapshot } from "./core/types";

  export interface ObservabilityConfig {
    enabled: boolean;
    adapter: "console" | "noop";
    sampleRate: number;
    actorSalt: string | null;
    clientEnabled: boolean;
    ingestPath: string;
    release: string | null;
    env: ContextSnapshot["env"];
  }

  function resolveEnv(): ContextSnapshot["env"] {
    const raw = process.env.NODE_ENV;
    if (raw === "production") return "production";
    if (raw === "test") return "test";
    return "development";
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
    const enabled = bool(process.env.OBSERVABILITY_ENABLED);
    return {
      enabled,
      adapter: adapter(process.env.OBSERVABILITY_ADAPTER),
      sampleRate: rate(process.env.OBSERVABILITY_SAMPLE_RATE),
      actorSalt: orNull(process.env.OBSERVABILITY_ACTOR_SALT),
      clientEnabled: enabled,
      ingestPath: orNull(process.env.OBSERVABILITY_INGEST_PATH) ?? "/api/telemetry",
      release: orNull(process.env.OBSERVABILITY_RELEASE),
      env: resolveEnv(),
    };
  }

  export function readClientConfig(): ObservabilityConfig {
    const enabled = bool(process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED);
    return {
      enabled,
      adapter: adapter(process.env.NEXT_PUBLIC_OBSERVABILITY_ADAPTER),
      sampleRate: rate(process.env.NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE),
      actorSalt: null, // соль никогда не уезжает на клиент
      clientEnabled: enabled,
      ingestPath:
        orNull(process.env.NEXT_PUBLIC_OBSERVABILITY_INGEST_PATH) ?? "/api/telemetry",
      release: orNull(process.env.NEXT_PUBLIC_RELEASE),
      env: resolveEnv(),
    };
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/config.test.ts`. Expect all 5 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/config.ts src/services/observability/config.test.ts && git commit -m "$(printf 'feat(observability): server/client config readers\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.5: Redaction (PII denylist)

**Files:**
- Create `src/services/observability/core/redact.ts`
- Create `src/services/observability/core/redact.test.ts`

**Interfaces:**
- Consumes: `Attributes` from `./types`.
- Produces: `DENY_KEY_PATTERNS: RegExp[]`, `redactAttributes(attrs: Attributes): Attributes`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/core/redact.test.ts`:
  ```ts
  // src/services/observability/core/redact.test.ts
  import { describe, it, expect } from "vitest";

  import type { Attributes } from "./types";
  import { DENY_KEY_PATTERNS, redactAttributes } from "./redact";

  describe("redactAttributes", () => {
    it("выбрасывает PII-ключи (case-insensitive), сохраняет примитивы", () => {
      const input: Attributes = {
        route: "/x",
        count: 3,
        ok: true,
        nada: null,
        Token: "abc",
        AUTHORIZATION: "Bearer y",
        password: "p",
        userEmail: "a@b.c",
        username: "joe",
        api_secret: "s",
        cookie: "sid=1",
      };
      const out = redactAttributes(input);
      expect(out).toEqual({ route: "/x", count: 3, ok: true, nada: null });
    });

    it("пустой объект → пустой объект", () => {
      expect(redactAttributes({})).toEqual({});
    });

    it("DENY_KEY_PATTERNS покрывает базовые PII-маркеры", () => {
      const joined = DENY_KEY_PATTERNS.map((re) => re.source).join("|");
      for (const marker of [
        "token",
        "authorization",
        "password",
        "email",
        "username",
        "secret",
        "cookie",
      ]) {
        expect(joined).toContain(marker);
      }
    });

    it("не мутирует вход", () => {
      const input: Attributes = { token: "x", route: "/y" };
      redactAttributes(input);
      expect(input.token).toBe("x");
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/core/redact.test.ts`. Expect failure: `Cannot find module './redact'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/core/redact.ts`:
  ```ts
  // src/services/observability/core/redact.ts
  // Чистая редакция PII-ключей из attributes. Без crypto, без сайд-эффектов.
  import type { Attributes } from "./types";

  // Денилист по ключу (case-insensitive через флаг i на каждом паттерне).
  export const DENY_KEY_PATTERNS: RegExp[] = [
    /token/i,
    /authorization/i,
    /password/i,
    /email/i,
    /username/i,
    /secret/i,
    /cookie/i,
  ];

  function isDenied(key: string): boolean {
    return DENY_KEY_PATTERNS.some((re) => re.test(key));
  }

  export function redactAttributes(attrs: Attributes): Attributes {
    const out: Attributes = {};
    for (const key of Object.keys(attrs)) {
      if (isDenied(key)) continue;
      const value = attrs[key];
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/core/redact.test.ts`. Expect all 4 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/core/redact.ts src/services/observability/core/redact.test.ts && git commit -m "$(printf 'feat(observability): PII attribute redaction\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.6: Error taxonomy (duck-typed classifier)

**Files:**
- Create `src/services/observability/core/taxonomy.ts`
- Create `src/services/observability/core/taxonomy.test.ts`

**Interfaces:**
- Consumes: `ErrorClass` from `./types`.
- Produces: `Classification`, `classifyError(error: unknown): Classification`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/core/taxonomy.test.ts`:
  ```ts
  // src/services/observability/core/taxonomy.test.ts
  import { describe, it, expect } from "vitest";

  import { classifyError } from "./taxonomy";

  describe("classifyError", () => {
    it("forbidden + reason='role' → forbidden.role, backendCode='forbidden'", () => {
      expect(classifyError({ code: "forbidden", reason: "role" })).toEqual({
        errorClass: "forbidden.role",
        backendCode: "forbidden",
      });
    });

    it("forbidden без reason → forbidden.role по умолчанию", () => {
      expect(classifyError({ code: "forbidden" })).toEqual({
        errorClass: "forbidden.role",
        backendCode: "forbidden",
      });
    });

    it("forbidden + reason='owner' → forbidden.owner", () => {
      expect(classifyError({ code: "forbidden", reason: "owner" }).errorClass).toBe(
        "forbidden.owner",
      );
    });

    it("banned → banned", () => {
      expect(classifyError({ code: "banned" })).toEqual({
        errorClass: "banned",
        backendCode: "banned",
      });
    });

    it("validation → validation", () => {
      expect(classifyError({ code: "validation" })).toEqual({
        errorClass: "validation",
        backendCode: "validation",
      });
    });

    it("TypeError → network", () => {
      expect(classifyError(new TypeError("boom"))).toEqual({
        errorClass: "network",
        backendCode: null,
      });
    });

    it("Error 'fetch failed' → network", () => {
      expect(classifyError(new Error("fetch failed")).errorClass).toBe("network");
    });

    it("сообщение содержит 'network' → network", () => {
      expect(classifyError(new Error("network down")).errorClass).toBe("network");
    });

    it("прочее → unexpected, backendCode=null", () => {
      expect(classifyError(new Error("weird"))).toEqual({
        errorClass: "unexpected",
        backendCode: null,
      });
    });

    it("не-объект (string) → unexpected", () => {
      expect(classifyError("oops")).toEqual({
        errorClass: "unexpected",
        backendCode: null,
      });
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/core/taxonomy.test.ts`. Expect failure: `Cannot find module './taxonomy'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/core/taxonomy.ts`:
  ```ts
  // src/services/observability/core/taxonomy.ts
  // Классификация ЛЮБОЙ ошибки утиной типизацией. НЕТ импортов из @/utils — избегаем циклов.
  import type { ErrorClass } from "./types";

  export interface Classification {
    errorClass: ErrorClass;
    backendCode: string | null;
  }

  function asRecord(error: unknown): Record<string, unknown> | null {
    return typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : null;
  }

  // Допустимые «хвосты» forbidden.* по контракту ErrorClass.
  const FORBIDDEN_REASONS = new Set(["role", "status", "owner", "guest"]);

  function messageOf(error: unknown): string {
    const rec = asRecord(error);
    const msg = rec?.message;
    return typeof msg === "string" ? msg : "";
  }

  export function classifyError(error: unknown): Classification {
    const rec = asRecord(error);
    const code = rec && typeof rec.code === "string" ? rec.code : null;

    if (code === "forbidden") {
      const reason =
        rec && typeof rec.reason === "string" && FORBIDDEN_REASONS.has(rec.reason)
          ? rec.reason
          : "role";
      return {
        errorClass: `forbidden.${reason}` as ErrorClass,
        backendCode: "forbidden",
      };
    }
    if (code === "banned") {
      return { errorClass: "banned", backendCode: "banned" };
    }
    if (code === "validation") {
      return { errorClass: "validation", backendCode: "validation" };
    }

    const msg = messageOf(error).toLowerCase();
    if (
      error instanceof TypeError ||
      msg.includes("fetch failed") ||
      msg.includes("network")
    ) {
      return { errorClass: "network", backendCode: null };
    }

    return { errorClass: "unexpected", backendCode: null };
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/core/taxonomy.test.ts`. Expect all 10 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/core/taxonomy.ts src/services/observability/core/taxonomy.test.ts && git commit -m "$(printf 'feat(observability): duck-typed error taxonomy\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.7: Memory + noop adapters

**Files:**
- Create `src/services/observability/adapters/noop-adapter.ts`
- Create `src/services/observability/adapters/memory-adapter.ts`
- Create `src/services/observability/adapters/memory-adapter.test.ts`

**Interfaces:**
- Consumes: `ObservabilitySink` from `../core/ports`; `ObservabilityRecord` from `../core/types`.
- Produces: `noopSink: ObservabilitySink`; `createMemorySink(): { sink, records, clear() }`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/adapters/memory-adapter.test.ts`:
  ```ts
  // src/services/observability/adapters/memory-adapter.test.ts
  import { describe, it, expect } from "vitest";

  import { baseContext } from "../core/registry";
  import type { LogRecord } from "../core/types";
  import { noopSink } from "./noop-adapter";
  import { createMemorySink } from "./memory-adapter";

  const rec: LogRecord = {
    kind: "log",
    level: "info",
    message: "m",
    attributes: {},
    context: baseContext("test", "server"),
    timestamp: 0,
  };

  describe("noopSink", () => {
    it("имеет имя и не бросает на emit", () => {
      expect(noopSink.name).toBe("noop");
      expect(() => noopSink.emit(rec)).not.toThrow();
    });
  });

  describe("createMemorySink", () => {
    it("копит записи в records", () => {
      const { sink, records } = createMemorySink();
      sink.emit(rec);
      sink.emit({ ...rec, message: "m2" });
      expect(records).toHaveLength(2);
      expect(records[0]?.kind).toBe("log");
    });

    it("clear() очищает буфер на месте", () => {
      const { sink, records, clear } = createMemorySink();
      sink.emit(rec);
      clear();
      expect(records).toHaveLength(0);
    });

    it("flush() резолвится", async () => {
      const { sink } = createMemorySink();
      await expect(sink.flush?.()).resolves.toBeUndefined();
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/adapters/memory-adapter.test.ts`. Expect failure: `Cannot find module './noop-adapter'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/adapters/noop-adapter.ts`:
  ```ts
  // src/services/observability/adapters/noop-adapter.ts
  // No-op sink: безопасный дефолт до инициализации. Изоморфен.
  import type { ObservabilitySink } from "../core/ports";

  export const noopSink: ObservabilitySink = {
    name: "noop",
    emit: () => {},
  };
  ```
  Then create `src/services/observability/adapters/memory-adapter.ts`:
  ```ts
  // src/services/observability/adapters/memory-adapter.ts
  // In-memory sink для тестов: накапливает записи в массив.
  import type { ObservabilitySink } from "../core/ports";
  import type { ObservabilityRecord } from "../core/types";

  export function createMemorySink(): {
    sink: ObservabilitySink;
    records: ObservabilityRecord[];
    clear(): void;
  } {
    const records: ObservabilityRecord[] = [];
    const sink: ObservabilitySink = {
      name: "memory",
      emit: (record) => {
        records.push(record);
      },
      flush: () => Promise.resolve(),
    };
    return {
      sink,
      records,
      clear: () => {
        records.length = 0;
      },
    };
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/adapters/memory-adapter.test.ts`. Expect all 4 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/adapters/noop-adapter.ts src/services/observability/adapters/memory-adapter.ts src/services/observability/adapters/memory-adapter.test.ts && git commit -m "$(printf 'feat(observability): noop + memory sinks\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.8: Facade (log / errors / metrics)

**Files:**
- Create `src/services/observability/core/facade.ts`
- Create `src/services/observability/core/facade.test.ts`

**Interfaces:**
- Consumes: `getContext`, `getSink`, `setSink` from `./registry`; `redactAttributes` from `./redact`; `classifyError` from `./taxonomy`; `readServerConfig` from `../config`; `Logger`, `ErrorReporter`, `Metrics` from `./ports`.
- Produces: `log: Logger`, `errors: ErrorReporter`, `metrics: Metrics`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/core/facade.test.ts`:
  ```ts
  // src/services/observability/core/facade.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import { createMemorySink } from "../adapters/memory-adapter";
  import { setContextProvider, setSink, baseContext } from "./registry";
  import type { ErrorRecord, LogRecord, MetricRecord } from "./types";
  import { errors, log, metrics } from "./facade";

  const mem = createMemorySink();

  beforeEach(() => {
    mem.clear();
    setSink(mem.sink);
    setContextProvider({
      getContext: () => ({ ...baseContext("test", "server"), requestId: "req-9" }),
    });
    vi.restoreAllMocks();
    // sampleRate=1 по умолчанию (NODE_ENV=test) → метрики не сэмплируются прочь.
    vi.spyOn(Math, "random").mockReturnValue(0); // меньше любого rate ⇒ пропускаем
  });

  describe("log", () => {
    it("штампует контекст+timestamp и редактирует attrs", () => {
      vi.spyOn(Date, "now").mockReturnValue(1234);
      log.info("hello", { route: "/x", token: "secret" });
      expect(mem.records).toHaveLength(1);
      const r = mem.records[0] as LogRecord;
      expect(r.kind).toBe("log");
      expect(r.level).toBe("info");
      expect(r.message).toBe("hello");
      expect(r.attributes).toEqual({ route: "/x" });
      expect(r.context.requestId).toBe("req-9");
      expect(r.timestamp).toBe(1234);
    });

    it("уровни debug/warn/error прокидываются", () => {
      log.debug("d");
      log.warn("w");
      log.error("e");
      expect(mem.records.map((r) => (r as LogRecord).level)).toEqual([
        "debug",
        "warn",
        "error",
      ]);
    });
  });

  describe("errors", () => {
    it("классифицирует через taxonomy, когда errorClass не задан; emit всегда", () => {
      errors.capture(new TypeError("fetch failed"), { attributes: { token: "x", a: "1" } });
      const r = mem.records[0] as ErrorRecord;
      expect(r.kind).toBe("error");
      expect(r.errorClass).toBe("network");
      expect(r.handled).toBe(true);
      expect(r.cause?.name).toBe("TypeError");
      expect(r.attributes).toEqual({ a: "1" });
    });

    it("уважает явный errorClass/backendCode/handled", () => {
      errors.capture(new Error("nope"), {
        errorClass: "forbidden.owner",
        backendCode: "forbidden",
        handled: false,
      });
      const r = mem.records[0] as ErrorRecord;
      expect(r.errorClass).toBe("forbidden.owner");
      expect(r.backendCode).toBe("forbidden");
      expect(r.handled).toBe(false);
    });

    it("ошибки НЕ сэмплируются (random=0.99 всё равно emit)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      errors.capture(new Error("x"));
      expect(mem.records).toHaveLength(1);
    });
  });

  describe("metrics", () => {
    it("increment пишет counter-запись", () => {
      metrics.increment("action.completed", { route: "/x" }, 2);
      const r = mem.records[0] as MetricRecord;
      expect(r.kind).toBe("metric");
      expect(r.metricKind).toBe("counter");
      expect(r.value).toBe(2);
      expect(r.unit).toBe("count");
      expect(r.metric).toBe("action.completed");
    });

    it("increment по умолчанию value=1", () => {
      metrics.increment("action.completed");
      expect((mem.records[0] as MetricRecord).value).toBe(1);
    });

    it("histogram пишет ms-запись", () => {
      metrics.histogram("action.duration", 42, { route: "/x" });
      const r = mem.records[0] as MetricRecord;
      expect(r.metricKind).toBe("histogram");
      expect(r.unit).toBe("ms");
      expect(r.value).toBe(42);
    });

    it("startTimer → endTimer эмитит histogram с прошедшими ms", () => {
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy.mockReturnValueOnce(1000); // старт
      const end = metrics.startTimer("action.duration", { route: "/x" });
      nowSpy.mockReturnValueOnce(1075); // конец
      end({ phase: "done" });
      const r = mem.records[0] as MetricRecord;
      expect(r.metricKind).toBe("histogram");
      expect(r.value).toBe(75);
      expect(r.attributes).toEqual({ route: "/x", phase: "done" });
    });

    it("sampleRate=0 → метрики отбрасываются", () => {
      // random(0) < rate(0) ложно ⇒ при rate=0 ничего не пишем.
      // Перекрываем env на 0 и пересоздаём sink-буфер.
      vi.stubEnv("OBSERVABILITY_SAMPLE_RATE", "0");
      vi.spyOn(Math, "random").mockReturnValue(0);
      metrics.increment("action.completed");
      expect(mem.records).toHaveLength(0);
      vi.unstubAllEnvs();
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/core/facade.test.ts`. Expect failure: `Cannot find module './facade'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/core/facade.ts`:
  ```ts
  // src/services/observability/core/facade.ts
  // Потребительский API наблюдаемости: log / errors / metrics. Изоморфен.
  import { readServerConfig } from "../config";
  import type { Attributes, Level } from "./types";
  import type {
    CaptureOptions,
    EndTimer,
    ErrorReporter,
    Logger,
    Metrics,
  } from "./ports";
  import { getContext, getSink } from "./registry";
  import { redactAttributes } from "./redact";
  import { classifyError } from "./taxonomy";

  // sampleRate читаем лениво на каждый emit — конфиг может меняться в тестах через env.
  function sampleRate(): number {
    return readServerConfig().sampleRate;
  }

  function sampled(): boolean {
    return Math.random() < sampleRate();
  }

  function emitLog(level: Level, message: string, attributes?: Attributes): void {
    getSink().emit({
      kind: "log",
      level,
      message,
      attributes: redactAttributes(attributes ?? {}),
      context: getContext(),
      timestamp: Date.now(),
    });
  }

  export const log: Logger = {
    debug: (m, a) => emitLog("debug", m, a),
    info: (m, a) => emitLog("info", m, a),
    warn: (m, a) => emitLog("warn", m, a),
    error: (m, a) => emitLog("error", m, a),
  };

  function causeOf(
    error: unknown,
  ): { name: string; message: string; stack: string | null } | null {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack ?? null,
      };
    }
    return null;
  }

  export const errors: ErrorReporter = {
    capture: (error: unknown, options?: CaptureOptions): void => {
      const classified = classifyError(error);
      const errorClass = options?.errorClass ?? classified.errorClass;
      const backendCode = options?.backendCode ?? classified.backendCode;
      const cause = causeOf(error);
      // Ошибки эмитим ВСЕГДА — без сэмплирования.
      getSink().emit({
        kind: "error",
        errorClass,
        message: cause?.message ?? String(error),
        backendCode,
        fingerprint: null,
        handled: options?.handled ?? true,
        cause,
        attributes: redactAttributes(options?.attributes ?? {}),
        context: getContext(),
        timestamp: Date.now(),
      });
    },
  };

  function emitMetric(
    metric: string,
    metricKind: "counter" | "histogram",
    value: number,
    unit: "ms" | "count" | null,
    attributes?: Attributes,
  ): void {
    if (!sampled()) return;
    getSink().emit({
      kind: "metric",
      metric,
      metricKind,
      value,
      unit,
      attributes: redactAttributes(attributes ?? {}),
      context: getContext(),
      timestamp: Date.now(),
    });
  }

  export const metrics: Metrics = {
    increment: (metric, attributes, value) =>
      emitMetric(metric, "counter", value ?? 1, "count", attributes),
    histogram: (metric, value, attributes) =>
      emitMetric(metric, "histogram", value, "ms", attributes),
    startTimer: (metric, attributes): EndTimer => {
      const start = Date.now();
      return (extra?: Attributes) => {
        const elapsed = Date.now() - start;
        emitMetric(metric, "histogram", elapsed, "ms", {
          ...(attributes ?? {}),
          ...(extra ?? {}),
        });
      };
    },
  };
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/core/facade.test.ts`. Expect all 11 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/core/facade.ts src/services/observability/core/facade.test.ts && git commit -m "$(printf 'feat(observability): log/errors/metrics facade\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.9: Console adapter (NDJSON in prod, pretty in dev)

**Files:**
- Create `src/services/observability/adapters/console-adapter.ts`
- Create `src/services/observability/adapters/console-adapter.test.ts`

**Interfaces:**
- Consumes: `ObservabilitySink` from `../core/ports`; `ObservabilityConfig` from `../config`.
- Produces: `createConsoleSink(cfg: ObservabilityConfig): ObservabilitySink`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/adapters/console-adapter.test.ts`:
  ```ts
  // src/services/observability/adapters/console-adapter.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import type { ObservabilityConfig } from "../config";
  import { baseContext } from "../core/registry";
  import type { ErrorRecord, LogRecord } from "../core/types";
  import { createConsoleSink } from "./console-adapter";

  function cfg(env: ObservabilityConfig["env"]): ObservabilityConfig {
    return {
      enabled: true,
      adapter: "console",
      sampleRate: 1,
      actorSalt: null,
      clientEnabled: true,
      ingestPath: "/api/telemetry",
      release: null,
      env,
    };
  }

  const logRec: LogRecord = {
    kind: "log",
    level: "info",
    message: "hi",
    attributes: { route: "/x" },
    context: baseContext("production", "server"),
    timestamp: 7,
  };

  const errRec: ErrorRecord = {
    kind: "error",
    errorClass: "network",
    message: "boom",
    backendCode: null,
    fingerprint: null,
    handled: false,
    cause: null,
    attributes: {},
    context: baseContext("production", "server"),
    timestamp: 7,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("createConsoleSink prod", () => {
    it("пишет NDJSON в process.stdout (одна строка + \\n)", () => {
      const write = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const sink = createConsoleSink(cfg("production"));
      sink.emit(logRec);
      expect(write).toHaveBeenCalledTimes(1);
      const arg = write.mock.calls[0]?.[0] as string;
      expect(arg.endsWith("\n")).toBe(true);
      expect(JSON.parse(arg.trimEnd())).toMatchObject({
        kind: "log",
        message: "hi",
      });
    });

    it("имя sink — console", () => {
      expect(createConsoleSink(cfg("production")).name).toBe("console");
    });
  });

  describe("createConsoleSink dev", () => {
    it("error-запись идёт в console.error", () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const sink = createConsoleSink(cfg("development"));
      sink.emit(errRec);
      expect(err).toHaveBeenCalledTimes(1);
    });

    it("log-запись уровня info идёт в console.info", () => {
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      const sink = createConsoleSink(cfg("development"));
      sink.emit(logRec);
      expect(info).toHaveBeenCalledTimes(1);
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/adapters/console-adapter.test.ts`. Expect failure: `Cannot find module './console-adapter'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/adapters/console-adapter.ts`:
  ```ts
  // src/services/observability/adapters/console-adapter.ts
  import "server-only";

  // Console-sink: в prod — NDJSON в stdout; в dev — pretty console.*
  // ЕДИНСТВЕННОЕ разрешённое исключение на прямой console в проекте.
  import type { ObservabilityConfig } from "../config";
  import type { ObservabilitySink } from "../core/ports";
  import type { ObservabilityRecord } from "../core/types";

  function devLevel(record: ObservabilityRecord): "info" | "warn" | "error" {
    if (record.kind === "error") return "error";
    if (record.kind === "log") {
      if (record.level === "error") return "error";
      if (record.level === "warn") return "warn";
    }
    return "info";
  }

  function emitDev(record: ObservabilityRecord): void {
    const level = devLevel(record);
    const tag = `[obs:${record.kind}]`;
    if (level === "error") console.error(tag, record);
    else if (level === "warn") console.warn(tag, record);
    else console.info(tag, record);
  }

  export function createConsoleSink(cfg: ObservabilityConfig): ObservabilitySink {
    const prod = cfg.env === "production";
    return {
      name: "console",
      emit: (record) => {
        if (prod) {
          process.stdout.write(`${JSON.stringify(record)}\n`);
        } else {
          emitDev(record);
        }
      },
    };
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/adapters/console-adapter.test.ts`. Expect all 4 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/adapters/console-adapter.ts src/services/observability/adapters/console-adapter.test.ts && git commit -m "$(printf 'feat(observability): console NDJSON/pretty sink\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.10: Beacon adapter (client ring buffer + sendBeacon)

**Files:**
- Create `src/services/observability/adapters/beacon-adapter.ts`
- Create `src/services/observability/adapters/beacon-adapter.test.ts`

**Interfaces:**
- Consumes: `ObservabilitySink` from `../core/ports`; `ObservabilityConfig` from `../config`.
- Produces: `createBeaconSink(cfg: ObservabilityConfig): ObservabilitySink`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/adapters/beacon-adapter.test.ts`:
  ```ts
  // src/services/observability/adapters/beacon-adapter.test.ts
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

  import type { ObservabilityConfig } from "../config";
  import { baseContext } from "../core/registry";
  import type { LogRecord } from "../core/types";
  import { createBeaconSink } from "./beacon-adapter";

  function cfg(): ObservabilityConfig {
    return {
      enabled: true,
      adapter: "console",
      sampleRate: 1,
      actorSalt: null,
      clientEnabled: true,
      ingestPath: "/api/telemetry",
      release: null,
      env: "production",
    };
  }

  const rec: LogRecord = {
    kind: "log",
    level: "info",
    message: "m",
    attributes: {},
    context: baseContext("production", "client"),
    timestamp: 1,
  };

  let sendBeacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("Blob", class {
      parts: unknown[];
      type: string;
      constructor(parts: unknown[], opts: { type: string }) {
        this.parts = parts;
        this.type = opts.type;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("createBeaconSink", () => {
    it("буферизует записи и НЕ шлёт до flush", () => {
      const sink = createBeaconSink(cfg());
      sink.emit(rec);
      sink.emit({ ...rec, message: "m2" });
      expect(sendBeacon).not.toHaveBeenCalled();
    });

    it("flush() шлёт буфер через sendBeacon на ingestPath и очищает буфер", async () => {
      const sink = createBeaconSink(cfg());
      sink.emit(rec);
      await sink.flush?.();
      expect(sendBeacon).toHaveBeenCalledTimes(1);
      const [path, body] = sendBeacon.mock.calls[0] ?? [];
      expect(path).toBe("/api/telemetry");
      expect((body as { type: string }).type).toBe("application/json");
      // Повторный flush без новых записей — ничего не шлёт.
      await sink.flush?.();
      expect(sendBeacon).toHaveBeenCalledTimes(1);
    });

    it("имя sink — beacon", () => {
      expect(createBeaconSink(cfg()).name).toBe("beacon");
    });

    it("ring buffer: при переполнении хранит только последние N (старые вытесняются)", async () => {
      const sink = createBeaconSink(cfg());
      // Эмитим 600 записей; кап буфера 500 → шлём ровно 500.
      for (let i = 0; i < 600; i++) sink.emit({ ...rec, timestamp: i });
      await sink.flush?.();
      const body = sendBeacon.mock.calls[0]?.[1] as { parts: string[] };
      const payload = JSON.parse(body.parts[0] ?? "[]") as unknown[];
      expect(payload).toHaveLength(500);
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/adapters/beacon-adapter.test.ts`. Expect failure: `Cannot find module './beacon-adapter'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/adapters/beacon-adapter.ts`:
  ```ts
  // src/services/observability/adapters/beacon-adapter.ts
  // Client-sink: кольцевой буфер записей, flush на visibilitychange/pagehide
  // через navigator.sendBeacon(ingestPath, Blob<json>).
  import type { ObservabilityConfig } from "../config";
  import type { ObservabilitySink } from "../core/ports";
  import type { ObservabilityRecord } from "../core/types";

  const RING_CAP = 500;

  export function createBeaconSink(cfg: ObservabilityConfig): ObservabilitySink {
    let buffer: ObservabilityRecord[] = [];

    function flush(): Promise<void> {
      if (buffer.length === 0) return Promise.resolve();
      const batch = buffer;
      buffer = [];
      const blob = new Blob([JSON.stringify(batch)], {
        type: "application/json",
      });
      navigator.sendBeacon(cfg.ingestPath, blob);
      return Promise.resolve();
    }

    // Авто-flush на уходе со страницы (в SSR/тесте window может отсутствовать).
    if (typeof window !== "undefined") {
      const onLeave = (): void => {
        void flush();
      };
      window.addEventListener("visibilitychange", onLeave);
      window.addEventListener("pagehide", onLeave);
    }

    return {
      name: "beacon",
      emit: (record) => {
        buffer.push(record);
        if (buffer.length > RING_CAP) {
          buffer = buffer.slice(buffer.length - RING_CAP);
        }
      },
      flush,
    };
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/adapters/beacon-adapter.test.ts`. Expect all 4 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/adapters/beacon-adapter.ts src/services/observability/adapters/beacon-adapter.test.ts && git commit -m "$(printf 'feat(observability): beacon client sink with ring buffer\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.11: Server context (hashActor, cache-memoized context, mutators, provider)

**Files:**
- Create `src/services/observability/context/server.ts`
- Create `src/services/observability/context/server.test.ts`

**Interfaces:**
- Consumes: `ContextSnapshot` from `../core/types`; `ContextProvider`, `baseContext` from `../core/registry`.
- Produces: `hashActor(id)`, `getServerContext()`, `setServerActor(id, role)`, `setServerRoute(route)`, `serverContextProvider: ContextProvider`.

> Test note: mock `node:crypto` (`randomUUID` deterministic) and mock React `cache` to identity so the memoized holder works under Vitest. Set `OBSERVABILITY_ACTOR_SALT` via `vi.stubEnv`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/context/server.test.ts`:
  ```ts
  // src/services/observability/context/server.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  // React cache() в Vitest заменяем на identity — мемоизация-холдер работает как обычная функция.
  vi.mock("react", async (orig) => {
    const actual = await orig<typeof import("react")>();
    return { ...actual, cache: <T,>(fn: T): T => fn };
  });

  import {
    getServerContext,
    hashActor,
    serverContextProvider,
    setServerActor,
    setServerRoute,
  } from "./server";

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("hashActor", () => {
    it("без соли → 'anon'", () => {
      vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "");
      expect(hashActor("user-1")).toBe("anon");
    });

    it("с солью → детерминированный псевдоним, не равный сырому id", () => {
      vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
      const a = hashActor("user-1");
      const b = hashActor("user-1");
      expect(a).toBe(b);
      expect(a).not.toBe("user-1");
      expect(a.length).toBeGreaterThan(0);
    });

    it("разные id → разные хеши", () => {
      vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
      expect(hashActor("a")).not.toBe(hashActor("b"));
    });
  });

  describe("getServerContext + mutators", () => {
    it("requestId присутствует, runtime=server, route=null изначально", () => {
      const ctx = getServerContext();
      expect(ctx.runtime).toBe("server");
      expect(typeof ctx.requestId).toBe("string");
      expect((ctx.requestId ?? "").length).toBeGreaterThan(0);
      expect(ctx.route).toBeNull();
    });

    it("setServerActor мутирует actorHash/actorRole в держателе контекста", () => {
      vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
      setServerActor("user-1", "admin");
      const ctx = getServerContext();
      expect(ctx.actorRole).toBe("admin");
      expect(ctx.actorHash).toBe(hashActor("user-1"));
    });

    it("setServerRoute мутирует route", () => {
      setServerRoute("/lectures/1");
      expect(getServerContext().route).toBe("/lectures/1");
    });
  });

  describe("serverContextProvider", () => {
    it("getContext() отдаёт server-контекст в скоупе", () => {
      const ctx = serverContextProvider.getContext();
      expect(ctx.runtime).toBe("server");
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/context/server.test.ts`. Expect failure: `Cannot find module './server'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/context/server.ts`:
  ```ts
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
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/context/server.test.ts`. Expect all 7 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/context/server.ts src/services/observability/context/server.test.ts && git commit -m "$(printf 'feat(observability): server context + actor hashing\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.12: Client context (singleton sessionId, mutators, provider)

**Files:**
- Create `src/services/observability/context/client.ts`
- Create `src/services/observability/context/client.test.ts`

**Interfaces:**
- Consumes: `ContextSnapshot` from `../core/types`; `ContextProvider`, `baseContext` from `../core/registry`.
- Produces: `getClientContext()`, `setClientActor(hash, role)`, `setClientRoute(route)`, `clientContextProvider: ContextProvider`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/context/client.test.ts`:
  ```ts
  // src/services/observability/context/client.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import {
    clientContextProvider,
    getClientContext,
    setClientActor,
    setClientRoute,
  } from "./client";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getClientContext", () => {
    it("singleton: тот же sessionId между вызовами, runtime=client", () => {
      const a = getClientContext();
      const b = getClientContext();
      expect(a.runtime).toBe("client");
      expect(typeof a.sessionId).toBe("string");
      expect((a.sessionId ?? "").length).toBeGreaterThan(0);
      expect(a.sessionId).toBe(b.sessionId);
    });

    it("route берётся из location.pathname", () => {
      expect(getClientContext().route).toBe(window.location.pathname);
    });
  });

  describe("client mutators", () => {
    it("setClientActor пишет actorHash/actorRole (уже хешированный hash)", () => {
      setClientActor("h-abc", "user");
      const ctx = getClientContext();
      expect(ctx.actorHash).toBe("h-abc");
      expect(ctx.actorRole).toBe("user");
    });

    it("setClientRoute обновляет route", () => {
      setClientRoute("/glossary");
      expect(getClientContext().route).toBe("/glossary");
    });
  });

  describe("clientContextProvider", () => {
    it("getContext() отдаёт тот же singleton", () => {
      expect(clientContextProvider.getContext().sessionId).toBe(
        getClientContext().sessionId,
      );
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/context/client.test.ts`. Expect failure: `Cannot find module './client'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/context/client.ts`:
  ```ts
  // src/services/observability/context/client.ts
  // Клиентский контекст: модульный синглтон на загрузку страницы. БЕЗ 'server-only'.
  import type { ContextSnapshot } from "../core/types";
  import { baseContext, type ContextProvider } from "../core/registry";

  function resolveEnv(): ContextSnapshot["env"] {
    const raw = process.env.NODE_ENV;
    if (raw === "production") return "production";
    if (raw === "test") return "test";
    return "development";
  }

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

  export function setClientActor(hash: string, role: string): void {
    ctx.actorHash = hash;
    ctx.actorRole = role;
  }

  export function setClientRoute(route: string): void {
    ctx.route = route;
  }

  export const clientContextProvider: ContextProvider = {
    getContext: (): ContextSnapshot => ctx,
  };
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/context/client.test.ts`. Expect all 5 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/context/client.ts src/services/observability/context/client.test.ts && git commit -m "$(printf 'feat(observability): client context singleton\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.13: Server barrel + initServerObservability

**Files:**
- Create `src/services/observability/index.ts`
- Create `src/services/observability/index.test.ts`

**Interfaces:**
- Consumes: `log/errors/metrics` from `./core/facade`; types from `./core/types`; `M`, `webVital` from `./core/names`; `setServerActor`, `setServerRoute`, `serverContextProvider` from `./context/server`; `readServerConfig` from `./config`; `setContextProvider`, `setSink` from `./core/registry`; `createConsoleSink` from `./adapters/console-adapter`; `noopSink` from `./adapters/noop-adapter`.
- Produces (re-exports): `log`, `errors`, `metrics`, all `types`, `M`, `webVital`, `setServerActor`, `setServerRoute`, `initServerObservability(): void`.

> Test note: mock `react` cache → identity (server.ts pulls it transitively). Spy on registry `setSink` to assert which adapter is wired by config.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/index.test.ts`:
  ```ts
  // src/services/observability/index.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  vi.mock("react", async (orig) => {
    const actual = await orig<typeof import("react")>();
    return { ...actual, cache: <T,>(fn: T): T => fn };
  });

  // Шпионим за реестром, чтобы проверить КАКОЙ sink подключён по конфигу.
  vi.mock("./core/registry", async (orig) => {
    const actual = await orig<typeof import("./core/registry")>();
    return { ...actual, setSink: vi.fn(actual.setSink), setContextProvider: vi.fn() };
  });

  import { setContextProvider, setSink } from "./core/registry";
  import { serverContextProvider } from "./context/server";
  import * as barrel from "./index";

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(setSink).mockClear();
    vi.mocked(setContextProvider).mockClear();
  });

  describe("server barrel exports", () => {
    it("реэкспортирует фасад, имена и server-мутаторы", () => {
      expect(typeof barrel.log.info).toBe("function");
      expect(typeof barrel.errors.capture).toBe("function");
      expect(typeof barrel.metrics.increment).toBe("function");
      expect(barrel.M.actionDuration).toBe("action.duration");
      expect(barrel.webVital("LCP")).toBe("web_vitals.LCP");
      expect(typeof barrel.setServerActor).toBe("function");
      expect(typeof barrel.setServerRoute).toBe("function");
    });
  });

  describe("initServerObservability", () => {
    it("adapter=console → подключает console-sink + serverContextProvider", () => {
      vi.stubEnv("OBSERVABILITY_ADAPTER", "console");
      vi.stubEnv("NODE_ENV", "production");
      barrel.initServerObservability();
      expect(setContextProvider).toHaveBeenCalledWith(serverContextProvider);
      const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
      expect(sink?.name).toBe("console");
    });

    it("adapter=noop → подключает noop-sink", () => {
      vi.stubEnv("OBSERVABILITY_ADAPTER", "noop");
      barrel.initServerObservability();
      const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
      expect(sink?.name).toBe("noop");
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/index.test.ts`. Expect failure: `Cannot find module './index'` (or missing `initServerObservability`).
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/index.ts`:
  ```ts
  // src/services/observability/index.ts
  import "server-only";

  // Server-барель наблюдаемости: единая точка для серверных потребителей.
  import { createConsoleSink } from "./adapters/console-adapter";
  import { noopSink } from "./adapters/noop-adapter";
  import { readServerConfig } from "./config";
  import { serverContextProvider } from "./context/server";
  import { setContextProvider, setSink } from "./core/registry";

  export { log, errors, metrics } from "./core/facade";
  export * from "./core/types";
  export { M, webVital } from "./core/names";
  export { setServerActor, setServerRoute } from "./context/server";

  // Идемпотентная инициализация: провайдер контекста + sink по конфигу.
  export function initServerObservability(): void {
    const cfg = readServerConfig();
    setContextProvider(serverContextProvider);
    setSink(cfg.adapter === "console" ? createConsoleSink(cfg) : noopSink);
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/index.test.ts`. Expect all 3 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/index.ts src/services/observability/index.test.ts && git commit -m "$(printf 'feat(observability): server barrel + init\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.14: Client-safe barrel + initClientObservability (no server-only)

**Files:**
- Create `src/services/observability/client.ts`
- Create `src/services/observability/client.test.ts`

**Interfaces:**
- Consumes: `log/errors/metrics` from `./core/facade`; types from `./core/types`; `M`, `webVital` from `./core/names`; `setClientActor`, `setClientRoute`, `clientContextProvider` from `./context/client`; `readClientConfig` from `./config`; `setContextProvider`, `setSink` from `./core/registry`; `createBeaconSink` from `./adapters/beacon-adapter`; `noopSink` from `./adapters/noop-adapter`.
- Produces (re-exports): `log`, `errors`, `metrics`, all `types`, `M`, `webVital`, `setClientActor`, `setClientRoute`, `initClientObservability(): void`.

> Test note: this test ALSO asserts the client barrel does NOT transitively import any `server-only` module — read the file source and the source of every module it imports, fail if any contains `import "server-only"` / `require("server-only")`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/client.test.ts`:
  ```ts
  // src/services/observability/client.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { readFileSync } from "node:fs";
  import path from "node:path";

  vi.mock("./core/registry", async (orig) => {
    const actual = await orig<typeof import("./core/registry")>();
    return { ...actual, setSink: vi.fn(actual.setSink), setContextProvider: vi.fn() };
  });

  vi.mock("./adapters/beacon-adapter", () => ({
    createBeaconSink: vi.fn(() => ({ name: "beacon", emit: () => {} })),
  }));

  import { setContextProvider, setSink } from "./core/registry";
  import { clientContextProvider } from "./context/client";
  import * as barrel from "./client";

  const HERE = path.resolve(__dirname);

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(setSink).mockClear();
    vi.mocked(setContextProvider).mockClear();
  });

  describe("client barrel exports", () => {
    it("реэкспортирует фасад, имена и client-мутаторы", () => {
      expect(typeof barrel.log.info).toBe("function");
      expect(typeof barrel.errors.capture).toBe("function");
      expect(typeof barrel.metrics.increment).toBe("function");
      expect(barrel.M.apiError).toBe("api.request.error");
      expect(barrel.webVital("CLS")).toBe("web_vitals.CLS");
      expect(typeof barrel.setClientActor).toBe("function");
      expect(typeof barrel.setClientRoute).toBe("function");
    });
  });

  describe("initClientObservability", () => {
    it("clientEnabled + adapter=console → beacon-sink + clientContextProvider", () => {
      vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENABLED", "1");
      vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ADAPTER", "console");
      barrel.initClientObservability();
      expect(setContextProvider).toHaveBeenCalledWith(clientContextProvider);
      const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
      expect(sink?.name).toBe("beacon");
    });

    it("выключено → noop-sink", () => {
      barrel.initClientObservability();
      const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
      expect(sink?.name).toBe("noop");
    });
  });

  describe("client safety", () => {
    it("ни client.ts, ни его прямые импорты НЕ тянут server-only", () => {
      // Файлы, которые client-барель импортирует (статически).
      const files = [
        "client.ts",
        "core/facade.ts",
        "core/types.ts",
        "core/names.ts",
        "core/registry.ts",
        "core/redact.ts",
        "core/taxonomy.ts",
        "core/ports.ts",
        "config.ts",
        "context/client.ts",
        "adapters/beacon-adapter.ts",
        "adapters/noop-adapter.ts",
      ];
      for (const rel of files) {
        const src = readFileSync(path.join(HERE, rel), "utf8");
        expect(src, `${rel} must NOT import server-only`).not.toMatch(
          /["']server-only["']/,
        );
      }
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** Run `pnpm vitest run src/services/observability/client.test.ts`. Expect failure: `Cannot find module './client'`.
- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/client.ts`:
  ```ts
  // src/services/observability/client.ts
  // Client-safe барель наблюдаемости. КРИТИЧНО: НЕ импортирует ничего server-only.
  import { createBeaconSink } from "./adapters/beacon-adapter";
  import { noopSink } from "./adapters/noop-adapter";
  import { readClientConfig } from "./config";
  import { clientContextProvider } from "./context/client";
  import { setContextProvider, setSink } from "./core/registry";

  export { log, errors, metrics } from "./core/facade";
  export * from "./core/types";
  export { M, webVital } from "./core/names";
  export { setClientActor, setClientRoute } from "./context/client";

  // Идемпотентная клиентская инициализация: провайдер + beacon/noop по конфигу.
  export function initClientObservability(): void {
    const cfg = readClientConfig();
    setContextProvider(clientContextProvider);
    setSink(cfg.clientEnabled && cfg.adapter === "console" ? createBeaconSink(cfg) : noopSink);
  }
  ```
- [ ] **Step 4: Run, expect PASS.** Run `pnpm vitest run src/services/observability/client.test.ts`. Expect all 4 tests green.
- [ ] **Step 5: Commit.** `git add src/services/observability/client.ts src/services/observability/client.test.ts && git commit -m "$(printf 'feat(observability): client-safe barrel + init\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.15: Document observability env vars in `.env.example`

**Files:**
- Modify `.env.example` (append an observability section — пер `readServerConfig`/`readClientConfig` из Task 0.4).

**Interfaces:**
- Consumes: env var names read by `config.ts` (Task 0.4). Produces: no code symbols — documents the config surface so operators know the knobs.

- [ ] **Step 1: Append the documented block.** Add to the end of `.env.example` (keep the file's Russian comment style):
  ```sh
  # ───────────────────────── Observability ─────────────────────────
  # Серверная телеметрия (логи/ошибки/метрики). Безопасные значения для примера.
  # Мастер-флаг: "1"/"true" включает серверный sink (иначе noop).
  OBSERVABILITY_ENABLED=
  # Серверный приёмник: "console" (NDJSON в stdout) | "noop". По умолчанию noop.
  OBSERVABILITY_ADAPTER=console
  # Доля сэмплирования логов/метрик [0..1]; ошибки НЕ сэмплируются. По умолчанию 1.
  OBSERVABILITY_SAMPLE_RATE=1
  # Соль для HMAC-хэша актора — СЕРВЕРНЫЙ СЕКРЕТ, не коммитить реальное значение.
  # Без соли actorHash = "anon". В проде задаётся через секреты окружения.
  OBSERVABILITY_ACTOR_SALT=
  # Путь приёма клиентских beacon'ов (должен совпадать с роутом app/api/telemetry).
  OBSERVABILITY_INGEST_PATH=/api/telemetry
  # Версия сборки (git sha) — попадает в поле record.context.release.
  OBSERVABILITY_RELEASE=

  # Клиентская телеметрия (вшивается в бандл — только NEXT_PUBLIC_*).
  NEXT_PUBLIC_OBSERVABILITY_ENABLED=
  NEXT_PUBLIC_OBSERVABILITY_ADAPTER=
  NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE=1
  NEXT_PUBLIC_OBSERVABILITY_INGEST_PATH=/api/telemetry
  NEXT_PUBLIC_RELEASE=
  ```
- [ ] **Step 2: Verify the vars match the config readers.** Run `grep -oE "OBSERVABILITY_[A-Z_]+|NEXT_PUBLIC_OBSERVABILITY_[A-Z_]+|NEXT_PUBLIC_RELEASE" src/services/observability/config.ts | sort -u` and confirm every name appears in `.env.example`. Expected: no config var is undocumented.
- [ ] **Step 3: Commit.** `git add .env.example && git commit -m "$(printf 'docs(observability): document env vars in .env.example\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 0.16: Phase gate — full suite green + barrel guard

**Files:**
- Modify `src/services/observability/index.test.ts` (append cross-barrel guard test) — lines: end of file.

**Interfaces:**
- Consumes: nothing new (verification only).
- Produces: no new symbols — gate that the whole module + repo stays green.

- [ ] **Step 1: Write the FAILING test.** Append to `src/services/observability/index.test.ts` a guard that the server barrel re-exports the SAME facade objects as the client barrel (single shared facade, no divergence):
  ```ts
  describe("barrel parity", () => {
    it("server и client барели делят один и тот же facade-инстанс", async () => {
      const server = await import("./index");
      const client = await import("./client");
      expect(server.log).toBe(client.log);
      expect(server.errors).toBe(client.errors);
      expect(server.metrics).toBe(client.metrics);
      expect(server.M).toBe(client.M);
    });
  });
  ```
- [ ] **Step 2: Run, expect FAIL (or confirm shape).** Run `pnpm vitest run src/services/observability/index.test.ts`. If the new `barrel parity` block is not yet present in compiled output it errors; expect the `barrel parity` describe to fail until the file is saved, then re-run.
- [ ] **Step 3: Minimal implementation.** No production code change is required — the parity already holds because both barrels import `./core/facade`. (If the assertion fails, the only legal fix is to ensure BOTH barrels import from `./core/facade` and neither re-wraps the objects — do not introduce new objects.)
- [ ] **Step 4: Run full module + repo gates, expect PASS.** Run `pnpm vitest run src/services/observability` (expect every Phase-0 test green), then `pnpm lint && pnpm test && pnpm build` (expect lint clean, coverage thresholds 41/30/40/42 still met, build OK).
- [ ] **Step 5: Commit.** `git add src/services/observability/index.test.ts && git commit -m "$(printf 'test(observability): barrel parity gate for phase 0\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`


---

## Phase 1: Server error-handling seams

Goal: instrument every server-side chokepoint (`createAction`/`createFormAction`, `rethrowApiError`, `getAuthState`, `requireCapability`/`requireActive`) so that each error is captured and classified through the Ф0 facade, with metrics on every action/auth/rbac/backend outcome. Depends on Phase 0 (facade + memory sink).

### Task 1.1: Instrument `createAction` / `createFormAction` with action metrics + error capture

**Files:**
- Modify `src/utils/create-action.ts` — add `name`/meta param to both factories; wrap the `try`/`catch` bodies (lines 69-103) with `metrics.startTimer(M.actionDuration)`, `action.completed` increments, and `errors.capture`.
- Create `src/utils/create-action.obs.test.ts`

**Interfaces:**
- Consumes: `log, errors, metrics, M, classifyError` from `@/services/observability` (server barrel); `createMemorySink` from `@/services/observability/adapters/memory-adapter`; `setSink` from `@/services/observability/core/registry`.
- Produces (signature change — backward compatible, `name` optional):
  ```ts
  export function createAction<TInput, TOutput>(
    fn: (input: TInput, ctx: FormActionContext) => Promise<TOutput>,
    name?: string
  ): (input: TInput, idempotencyKey?: string) => Promise<ActionResult<TOutput>>;
  export function createFormAction<TOutput>(
    fn: (formData: FormData, ctx: FormActionContext) => Promise<TOutput>,
    name?: string
  ): (prevState: ActionResult<TOutput>, formData: FormData) => Promise<ActionResult<TOutput>>;
  ```

- [ ] **Step 1: Write the FAILING test.** Create `src/utils/create-action.obs.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
  import { setSink } from "@/services/observability/core/registry";
  import type { ObservabilityRecord } from "@/services/observability/core/types";

  import { createAction } from "./create-action";
  import { ForbiddenError } from "./permissions";

  const mem = createMemorySink();

  beforeEach(() => {
    mem.clear();
    setSink(mem.sink);
  });

  function metricsOf(records: ObservabilityRecord[], metric: string) {
    return records.filter((r) => r.kind === "metric" && r.metric === metric);
  }

  describe("createAction observability", () => {
    it("эмитит action.duration и action.completed{outcome:success} при успехе", async () => {
      const action = createAction(async (n: number) => n + 1, "bumpNumber");
      const result = await action(41);
      expect(result).toEqual({ success: true, data: 42 });

      const completed = metricsOf(mem.records, "action.completed");
      expect(completed).toHaveLength(1);
      expect(completed[0]?.attributes).toMatchObject({
        action: "bumpNumber",
        outcome: "success",
      });
      expect(metricsOf(mem.records, "action.duration")).toHaveLength(1);
    });

    it("captures классифицированную ошибку и эмитит outcome=errorClass при отказе", async () => {
      const action = createAction(async () => {
        throw new ForbiddenError("role");
      }, "denyAction");
      const result = await action(undefined);
      expect(result).toEqual({
        success: false,
        error: "Forbidden: role",
        code: "forbidden",
      });

      const captured = mem.records.filter((r) => r.kind === "error");
      expect(captured).toHaveLength(1);
      expect(captured[0]).toMatchObject({
        kind: "error",
        errorClass: "forbidden.role",
      });
      const completed = metricsOf(mem.records, "action.completed");
      expect(completed[0]?.attributes).toMatchObject({
        action: "denyAction",
        outcome: "forbidden.role",
      });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/utils/create-action.obs.test.ts` — expect failure: `expected [] to have a length of 1` (no records emitted; `createAction` is not yet instrumented).

- [ ] **Step 3: Minimal implementation.** Edit `src/utils/create-action.ts`. Replace the import block (lines 10-14) with:
  ```ts
  import { redirect } from "next/navigation";
  import { z, type ZodType } from "zod";

  import { errors, metrics, M, classifyError } from "@/services/observability";

  import { readIdempotencyKey } from "./idempotency";
  import { BannedError, ForbiddenError } from "./permissions";
  ```
  Add this helper just above `export function createAction` (after `toResult`, line 59) — it centralises the catch-side instrumentation and returns the outcome string for the metric:
  ```ts
  /** Инструментирует ветку catch: re-throw Next-внутренних ошибок, capture
   * остальных с классификацией. Возвращает outcome-строку для action.completed.
   * Контроль-флоу повторяет исходный: Banned → redirect, Next-internal → throw. */
  function captureActionError(error: unknown, name: string): string {
    if (error instanceof BannedError) {
      errors.capture(error, { errorClass: "banned", handled: true, attributes: { action: name } });
      redirect("/auth/forced-logout");
    }
    if (isNextInternalError(error)) throw error;
    const { errorClass, backendCode } = classifyError(error);
    errors.capture(error, {
      errorClass,
      ...(backendCode !== null ? { backendCode } : {}),
      handled: true,
      attributes: { action: name },
    });
    return errorClass;
  }
  ```
  Replace `createAction` (lines 69-82) with:
  ```ts
  export function createAction<TInput, TOutput>(
    fn: (input: TInput, ctx: FormActionContext) => Promise<TOutput>,
    name = "anonymous"
  ): (input: TInput, idempotencyKey?: string) => Promise<ActionResult<TOutput>> {
    return async (input: TInput, idempotencyKey?: string) => {
      const end = metrics.startTimer(M.actionDuration, { action: name });
      try {
        const data = await fn(input, { idempotencyKey });
        metrics.increment(M.actionCompleted, { action: name, outcome: "success" });
        return { success: true, data };
      } catch (error) {
        const outcome = captureActionError(error, name);
        metrics.increment(M.actionCompleted, { action: name, outcome });
        return toResult<TOutput>(error);
      } finally {
        end();
      }
    };
  }
  ```
  Replace `createFormAction` (lines 84-103) with:
  ```ts
  export function createFormAction<TOutput>(
    fn: (formData: FormData, ctx: FormActionContext) => Promise<TOutput>,
    name = "anonymous"
  ): (
    prevState: ActionResult<TOutput>,
    formData: FormData
  ) => Promise<ActionResult<TOutput>> {
    return async (_prevState: ActionResult<TOutput>, formData: FormData) => {
      const end = metrics.startTimer(M.actionDuration, { action: name });
      try {
        const ctx: FormActionContext = {
          idempotencyKey: readIdempotencyKey(formData),
        };
        const data = await fn(formData, ctx);
        metrics.increment(M.actionCompleted, { action: name, outcome: "success" });
        return { success: true, data };
      } catch (error) {
        const outcome = captureActionError(error, name);
        metrics.increment(M.actionCompleted, { action: name, outcome });
        return toResult<TOutput>(error);
      } finally {
        end();
      }
    };
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/utils/create-action.obs.test.ts` — expect: `2 passed`.

- [ ] **Step 5: Commit.** `git add src/utils/create-action.ts src/utils/create-action.obs.test.ts && git commit -m "$(printf 'feat(observability): instrument createAction/createFormAction seam\n\naction.duration timer + action.completed{outcome} metric, error capture\nwith classification; Banned→capture then redirect, Next-internal re-thrown.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 1.2: Codemod — add the `name` argument to all 24 `createAction`/`createFormAction` call sites

**Files:**
- Modify (call-site argument added — one entry per file):
  `src/features/annotations/actions.ts`, `src/features/auth/actions.ts`, `src/features/banners/actions.ts`, `src/features/canvas/actions.ts`, `src/features/comments/actions.ts`, `src/features/documents/actions.ts`, `src/features/events/actions.ts`, `src/features/forms/actions.ts`, `src/features/glossary/actions.ts`, `src/features/lectures/actions.ts`, `src/features/media/actions.ts`, `src/features/notifications/actions.ts`, `src/features/preferences/actions.ts`, `src/features/share-links/actions.ts`, `src/features/statistics/actions.ts`, `src/features/tags/actions.ts`, `src/features/trails/actions.ts`, `src/features/users/actions.ts`.
  (`src/features/_template/actions.ts` is excluded from coverage — update it too for the template, but it is not in the gated set.)

**Interfaces:**
- Consumes: `createAction(fn, name)` / `createFormAction(fn, name)` from Task 1.1.
- Produces: every exported action passes its own export identifier as `name` (e.g. `"createComment"`), so `M.actionDuration`/`M.actionCompleted` carry a stable `action` attribute across the seam.

- [ ] **Step 1: Enumerate the call sites.** Run `grep -rno "export const [a-zA-Z0-9_]* = create\(Action\|FormAction\)" src/features --include=actions.ts` to list every `export const <name> = createAction(`/`createFormAction(` and its file:line. This is the authoritative worklist (the `name` you pass MUST equal `<name>`).

- [ ] **Step 2: Apply the codemod, file by file.** For each match, insert the export identifier as a string second argument to the factory call. The factory call always ends with `})` (single-arg arrow) or `},\n)` (multi-line). Add `, "<name>"` before that closing `)`. Concrete before/after — `src/features/comments/actions.ts`:
  - `createComment` (line 59-80): change `export const createComment = createFormAction(async (formData, ctx) => {` … closing `});` → keep body identical, closing becomes:
    ```ts
    }, "createComment");
    ```
  - `deleteComment` (line 109-122): `export const deleteComment = createAction(async (rawId: string, ctx) => {` … closing `});` →
    ```ts
    }, "deleteComment");
    ```
  - `setReaction` (line 140-154, multi-line closing `},\n);`) →
    ```ts
      },
      "setReaction",
    );
    ```
  Repeat for `updateCommentBlocks` → `"updateCommentBlocks"`, `adminDeleteComment` → `"adminDeleteComment"`, `removeReaction` → `"removeReaction"`, and for every export in the remaining 17 feature files (e.g. `documents/actions.ts`: `createDocument` → `"createDocument"`, `adminDeleteDocument` → `"adminDeleteDocument"`; `users/actions.ts`: each `export const`). Do NOT touch the arrow body — only the trailing argument.

- [ ] **Step 3: Verify nothing was missed.** Run `grep -rn "= create\(Action\|FormAction\)(async" src/features --include=actions.ts | wc -l` and confirm it equals the count of lines containing `, "` factory-name arguments you added — i.e. `grep -rnc '}, "\|^  "[a-zA-Z]*",$' src/features --include=actions.ts`. Every factory call must now carry a name.

- [ ] **Step 4: Typecheck, expect PASS.** `pnpm typecheck` — expect no errors. (`name?: string` is optional, so a missed site would still compile; this step confirms the inserted string literals are syntactically valid and no arrow body was broken.)

- [ ] **Step 5: Run the existing rbac suites, expect PASS.** `pnpm test src/features/comments/actions-rbac.test.ts src/features/documents/actions-rbac.test.ts src/features/users/actions-rbac.test.ts` — expect all green (codemod must not change control flow).

- [ ] **Step 6: Commit.** `git add src/features/annotations/actions.ts src/features/auth/actions.ts src/features/banners/actions.ts src/features/canvas/actions.ts src/features/comments/actions.ts src/features/documents/actions.ts src/features/events/actions.ts src/features/forms/actions.ts src/features/glossary/actions.ts src/features/lectures/actions.ts src/features/media/actions.ts src/features/notifications/actions.ts src/features/preferences/actions.ts src/features/share-links/actions.ts src/features/statistics/actions.ts src/features/tags/actions.ts src/features/trails/actions.ts src/features/users/actions.ts src/features/_template/actions.ts && git commit -m "$(printf 'refactor(observability): name all server action call sites\n\nPass export identifier as the createAction/createFormAction name arg so\naction.* metrics carry a stable {action} attribute. Behaviour unchanged.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 1.3: Instrument `rethrowApiError` with backend.error metric + unmapped-code capture

**Files:**
- Modify `src/utils/api-error.ts` — add a `metrics.increment(M.backendError)` before the throw chain and an `errors.capture` in the final fallback (lines 85-104).
- Create `src/utils/api-error.obs.test.ts`

**Interfaces:**
- Consumes: `errors, metrics, M` from `@/services/observability`.
- Produces: `M.backendError{code}` increment for every `code`-bearing call; `errors.capture({errorClass:"unexpected", backendCode:code, handled:true, attributes:{reason:"unmapped_backend_code"}})` on the unmapped-code fallback. Return type stays `never`.

- [ ] **Step 1: Write the FAILING test.** Create `src/utils/api-error.obs.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
  import { setSink } from "@/services/observability/core/registry";

  import { rethrowApiError } from "./api-error";

  const mem = createMemorySink();

  beforeEach(() => {
    mem.clear();
    setSink(mem.sink);
  });

  describe("rethrowApiError observability", () => {
    it("эмитит backend.error{code} перед throw для маппленного кода", () => {
      expect(() => rethrowApiError({ code: "VERSION_MISMATCH" })).toThrow();
      const m = mem.records.filter(
        (r) => r.kind === "metric" && r.metric === "backend.error",
      );
      expect(m).toHaveLength(1);
      expect(m[0]?.attributes).toMatchObject({ code: "VERSION_MISMATCH" });
      // маппленный код НЕ должен попадать в error-capture
      expect(mem.records.some((r) => r.kind === "error")).toBe(false);
    });

    it("captures unmapped код как unexpected с reason=unmapped_backend_code", () => {
      expect(() =>
        rethrowApiError({ code: "TOTALLY_UNKNOWN_CODE" as never }),
      ).toThrow();
      const errs = mem.records.filter((r) => r.kind === "error");
      expect(errs).toHaveLength(1);
      expect(errs[0]).toMatchObject({
        kind: "error",
        errorClass: "unexpected",
        backendCode: "TOTALLY_UNKNOWN_CODE",
        handled: true,
      });
      expect(errs[0]?.attributes).toMatchObject({
        reason: "unmapped_backend_code",
      });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/utils/api-error.obs.test.ts` — expect failure: `expected [] to have a length of 1` (no metric emitted yet).

- [ ] **Step 3: Minimal implementation.** Edit `src/utils/api-error.ts`. Replace the import block (lines 1-4) with:
  ```ts
  import "server-only";
  import type { ApiErrorCode } from "@/api/types";
  import { errors, metrics, M } from "@/services/observability";

  import { BannedError, ForbiddenError } from "./permissions";
  ```
  Replace the body of `rethrowApiError` (lines 85-104) with:
  ```ts
  export function rethrowApiError(
    err: ApiError | undefined,
    overrides?: ApiErrorMessages,
  ): never {
    const code = err?.code;
    if (code) {
      // Метрика по доменному коду — до любого throw, чтобы попадали все ветки.
      metrics.increment(M.backendError, { code });
      if (code === "BANNED") {
        throw new BannedError(err.error ?? "Account banned");
      }
      if (ROLE_FORBIDDEN_CODES.has(code)) {
        throw new ForbiddenError("role", err.error);
      }
      if (STATUS_FORBIDDEN_CODES.has(code)) {
        throw new ForbiddenError("status", err.error ?? "Аккаунт ограничен.");
      }
      const text = overrides?.[code] ?? DEFAULT_MESSAGES[code];
      if (text) throw new Error(text);
      // Код есть, но нигде не сопоставлен — это дрифт контракта, не юзер-ошибка.
      errors.capture(new Error(err.error ?? `Unmapped backend code: ${code}`), {
        errorClass: "unexpected",
        backendCode: code,
        handled: true,
        attributes: { reason: "unmapped_backend_code" },
      });
    }
    throw new Error(err?.error ?? "Ошибка сервера");
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/utils/api-error.obs.test.ts` — expect: `2 passed`.

- [ ] **Step 5: Commit.** `git add src/utils/api-error.ts src/utils/api-error.obs.test.ts && git commit -m "$(printf 'feat(observability): emit backend.error metric + capture unmapped codes\n\nrethrowApiError increments M.backendError{code} before the throw chain and\ncaptures unmapped backend codes as unexpected{reason:unmapped_backend_code}.\nReturn type stays never.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 1.4: Instrument `getAuthState` with auth.resolve metric, actor stamping, and 5xx/malformed capture

**Files:**
- Modify `src/utils/me.ts` — instrument the `getAuthState` cache body (lines 49-95): emit `M.authResolve{result}`, capture on 5xx/malformed throws, call `setServerActor` on success.
- Create `src/utils/me.obs.test.ts`

**Interfaces:**
- Consumes: `errors, metrics, M, setServerActor` from `@/services/observability`.
- Produces: `M.authResolve{result:"guest"|"active"|"suspended"|"banned"}` for every resolution; `errors.capture({errorClass:"backend.5xx", handled:false})` on 5xx; `errors.capture({errorClass:"unexpected", handled:false})` on malformed payload; `setServerActor(me.id, me.role)` on success.

- [ ] **Step 1: Write the FAILING test.** Create `src/utils/me.obs.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
  import { setSink } from "@/services/observability/core/registry";

  const setServerActor = vi.fn();
  vi.mock("@/services/observability", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/services/observability")>();
    return { ...actual, setServerActor };
  });

  const cookieGet = vi.fn();
  vi.mock("next/headers", () => ({
    cookies: async () => ({ get: cookieGet }),
  }));
  vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return { ...actual, cache: <T,>(fn: T) => fn };
  });

  const mem = createMemorySink();

  beforeEach(() => {
    mem.clear();
    setSink(mem.sink);
    setServerActor.mockClear();
    cookieGet.mockReset();
    vi.unstubAllGlobals();
  });

  function metric(name: string) {
    return mem.records.filter((r) => r.kind === "metric" && r.metric === name);
  }

  describe("getAuthState observability", () => {
    it("guest без токена → auth.resolve{result:guest}, без setServerActor", async () => {
      cookieGet.mockReturnValue(undefined);
      const { getMe } = await import("./me");
      expect(await getMe()).toBeNull();
      expect(metric("auth.resolve")[0]?.attributes).toMatchObject({ result: "guest" });
      expect(setServerActor).not.toHaveBeenCalled();
    });

    it("active me → auth.resolve{result:active} + setServerActor(id, role)", async () => {
      cookieGet.mockReturnValue({ value: "tok" });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          status: 200,
          ok: true,
          json: async () => ({
            data: {
              id: "u1",
              username: "ann",
              role: "user",
              status: "active",
              capabilities: [],
            },
          }),
        })),
      );
      const { getMe } = await import("./me");
      const me = await getMe();
      expect(me?.id).toBe("u1");
      expect(metric("auth.resolve")[0]?.attributes).toMatchObject({ result: "active" });
      expect(setServerActor).toHaveBeenCalledWith("u1", "user");
    });

    it("5xx → throw + capture backend.5xx{handled:false}", async () => {
      cookieGet.mockReturnValue({ value: "tok" });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ status: 503, ok: false, json: async () => ({}) })),
      );
      const { getMe } = await import("./me");
      await expect(getMe()).rejects.toThrow(/503/);
      const errs = mem.records.filter((r) => r.kind === "error");
      expect(errs[0]).toMatchObject({ errorClass: "backend.5xx", handled: false });
    });

    it("malformed payload → throw + capture unexpected{handled:false}", async () => {
      cookieGet.mockReturnValue({ value: "tok" });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ status: 200, ok: true, json: async () => ({ data: { id: "x" } }) })),
      );
      const { getMe } = await import("./me");
      await expect(getMe()).rejects.toThrow(/malformed/);
      const errs = mem.records.filter((r) => r.kind === "error");
      expect(errs[0]).toMatchObject({ errorClass: "unexpected", handled: false });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/utils/me.obs.test.ts` — expect failure: `expected undefined to match object { result: 'guest' }` (no `auth.resolve` metric emitted yet).

- [ ] **Step 3: Minimal implementation.** Edit `src/utils/me.ts`. Replace the import block (lines 1-7) with:
  ```ts
  import "server-only";

  import { cookies } from "next/headers";
  import { redirect } from "next/navigation";
  import { cache } from "react";

  import type { components } from "@/api/schema";
  import { errors, metrics, M, setServerActor } from "@/services/observability";
  ```
  Replace the `getAuthState` cache body (lines 49-95) with:
  ```ts
  const getAuthState = cache(async (): Promise<AuthState> => {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      metrics.increment(M.authResolve, { result: "guest" });
      return NO_AUTH;
    }

    const res = await fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (res.status === 403) {
      let code: string | undefined;
      try {
        const body = (await res.json()) as { code?: string };
        code = body.code;
      } catch {
        // тело не JSON / пустое — трактуем как небанный 403 (обычный гость)
      }
      const banned = code === "BANNED";
      metrics.increment(M.authResolve, { result: banned ? "banned" : "guest" });
      return { me: null, banned };
    }
    if (res.status === 401 || res.status === 404) {
      metrics.increment(M.authResolve, { result: "guest" });
      return NO_AUTH;
    }
    if (!res.ok) {
      const err = new Error(`getMe(): backend returned ${res.status}`);
      errors.capture(err, { errorClass: "backend.5xx", handled: false });
      throw err;
    }

    const json: unknown = await res.json();
    const candidate =
      typeof json === "object" && json !== null && "data" in json
        ? (json as { data: unknown }).data
        : json;

    if (
      !candidate ||
      typeof candidate !== "object" ||
      !("id" in candidate) ||
      !("username" in candidate) ||
      !("role" in candidate) ||
      !("status" in candidate) ||
      !("capabilities" in candidate)
    ) {
      const err = new Error("getMe(): backend returned malformed payload");
      errors.capture(err, { errorClass: "unexpected", handled: false });
      throw err;
    }

    const me = candidate as Me;
    setServerActor(me.id, me.role);
    metrics.increment(M.authResolve, {
      result: me.status === "active" ? "active" : "suspended",
    });
    return { me, banned: false };
  });
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/utils/me.obs.test.ts` — expect: `4 passed`.

- [ ] **Step 5: Commit.** `git add src/utils/me.ts src/utils/me.obs.test.ts && git commit -m "$(printf 'feat(observability): instrument getAuthState auth.resolve + actor stamp\n\nEmit M.authResolve{result} for guest/active/suspended/banned, stamp the\nserver actor on success, capture 5xx as backend.5xx and malformed payload\nas unexpected (both handled:false).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 1.5: Instrument `requireCapability` / `requireActive` with rbac.denied metric

**Files:**
- Modify `src/utils/permissions.ts` — emit `M.rbacDenied{reason}` before each `throw new ForbiddenError(...)` in `requireCapability` (lines 114-122) and `requireActive` (lines 132-137).
- Create `src/utils/permissions.obs.test.ts`

**Interfaces:**
- Consumes: `metrics, M` from `@/services/observability`.
- Produces: `M.rbacDenied{reason}` increment (`reason` = the `DenyReason` of the about-to-throw `ForbiddenError`) on every deny path of `requireCapability`/`requireActive`. Success paths emit nothing.

- [ ] **Step 1: Write the FAILING test.** Create `src/utils/permissions.obs.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
  import { setSink } from "@/services/observability/core/registry";
  import type { Me } from "./me";

  import { requireActive, requireCapability, ForbiddenError } from "./permissions";

  const mem = createMemorySink();

  beforeEach(() => {
    mem.clear();
    setSink(mem.sink);
  });

  function denied() {
    return mem.records.filter((r) => r.kind === "metric" && r.metric === "rbac.denied");
  }

  const activeMe: Me = {
    id: "u1",
    username: "ann",
    role: "user",
    status: "active",
    capabilities: [],
  };

  describe("rbac.denied metric", () => {
    it("guest deny → rbac.denied{reason:guest}", () => {
      expect(() => requireCapability(null, () => false)).toThrow(ForbiddenError);
      expect(denied()[0]?.attributes).toMatchObject({ reason: "guest" });
    });

    it("role deny (active без cap) → rbac.denied{reason:role}", () => {
      expect(() => requireCapability(activeMe, () => false)).toThrow(ForbiddenError);
      expect(denied()[0]?.attributes).toMatchObject({ reason: "role" });
    });

    it("suspended deny → rbac.denied{reason:status}", () => {
      const suspended: Me = { ...activeMe, status: "suspended" };
      expect(() => requireActive(suspended)).toThrow(ForbiddenError);
      expect(denied()[0]?.attributes).toMatchObject({ reason: "status" });
    });

    it("success path не эмитит rbac.denied", () => {
      requireActive(activeMe);
      expect(denied()).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/utils/permissions.obs.test.ts` — expect failure: `expected undefined to match object { reason: 'guest' }` (no metric emitted yet).

- [ ] **Step 3: Minimal implementation.** Edit `src/utils/permissions.ts`. Replace the import block (lines 1-3) with:
  ```ts
  import type { Capability } from "@/api/types";
  import { metrics, M } from "@/services/observability";

  import type { MaybeMe } from "./me";
  ```
  Replace `requireCapability` (lines 114-122) with:
  ```ts
  export function requireCapability(
    me: MaybeMe,
    check: (me: MaybeMe) => boolean
  ): asserts me is NonNullable<MaybeMe> {
    if (check(me)) return;
    const reason = !me ? "guest" : me.status !== "active" ? "status" : "role";
    metrics.increment(M.rbacDenied, { reason });
    throw new ForbiddenError(reason);
  }
  ```
  Replace `requireActive` (lines 132-137) with:
  ```ts
  export function requireActive(
    me: MaybeMe
  ): asserts me is NonNullable<MaybeMe> {
    if (me && me.status === "active") return;
    const reason = !me ? "guest" : "status";
    metrics.increment(M.rbacDenied, { reason });
    throw new ForbiddenError(reason);
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/utils/permissions.obs.test.ts` — expect: `4 passed`.

- [ ] **Step 5: Commit.** `git add src/utils/permissions.ts src/utils/permissions.obs.test.ts && git commit -m "$(printf 'feat(observability): emit rbac.denied metric on capability denials\n\nrequireCapability/requireActive increment M.rbacDenied{reason} before the\nForbiddenError throw; success paths stay silent. DenyReason unchanged.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

### Task 1.6: Phase gate — full suite, typecheck, lint, build green

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite.** `pnpm test` — expect all suites green, including the new `*.obs.test.ts` files and existing rbac/action suites; coverage thresholds (statements 41 / branches 30 / functions 40 / lines 42) must hold.

- [ ] **Step 2: Typecheck.** `pnpm typecheck` — expect no errors (confirms the codemod `name` arguments and new imports compile under `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess`).

- [ ] **Step 3: Lint.** `pnpm lint` — expect no errors; specifically confirm no `import/no-cycle` violation between `@/services/observability` and `src/utils/*` (facade must not import `me.ts`/`api-error.ts`/`permissions.ts`).

- [ ] **Step 4: Build.** `pnpm build` — expect success (validates the `server-only` boundary: `me.ts`/`api-error.ts` import the server barrel, not `./client`).


---

## Phase 2: Server Metrics & Instrumentation

Goal: instrument the outbound openapi-fetch clients and every raw `fetch` surface with request-id stamping plus duration/error metrics, count mutation commits, and wire the Next instrumentation hook so server observability boots on process start.

### Task 2.1: Shared `instrumentedFetch` wrapper

**Files:**
- Create `src/services/observability/server-fetch.ts`
- Create `src/services/observability/server-fetch.test.ts`

**Interfaces:**
- Consumes: `getServerContext(): ContextSnapshot` from `./context/server`; `metrics: Metrics`, `errors: ErrorReporter` from `./core/facade`; `M` from `./core/names`.
- Produces: `export async function instrumentedFetch(input: RequestInfo | URL, init?: RequestInit, meta?: { surface: string }): Promise<Response>`

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/server-fetch.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  vi.mock("./context/server", () => ({
    getServerContext: () => ({
      env: "test", runtime: "server", release: null,
      requestId: "req-7", sessionId: null, route: null,
      actorHash: null, actorRole: null,
    }),
  }));

  const increment = vi.fn();
  const histogram = vi.fn();
  const capture = vi.fn();
  vi.mock("./core/facade", () => ({
    metrics: {
      increment: (...a: unknown[]) => increment(...a),
      histogram: (...a: unknown[]) => histogram(...a),
      startTimer: () => () => {},
    },
    errors: { capture: (...a: unknown[]) => capture(...a) },
  }));

  import { instrumentedFetch } from "./server-fetch";
  import { M } from "./core/names";

  describe("instrumentedFetch", () => {
    beforeEach(() => {
      increment.mockClear();
      histogram.mockClear();
      capture.mockClear();
    });

    it("stamps X-Request-Id and records api.duration on success", async () => {
      const fetchMock = vi.fn(async () => new Response("ok", { status: 204 }));
      vi.stubGlobal("fetch", fetchMock);

      const res = await instrumentedFetch("http://x/y", { method: "POST" }, { surface: "media.upload" });

      expect(res.status).toBe(204);
      const passedInit = fetchMock.mock.calls[0]![1] as RequestInit;
      const headers = new Headers(passedInit.headers);
      expect(headers.get("X-Request-Id")).toBe("req-7");
      expect(histogram).toHaveBeenCalledWith(
        M.apiDuration,
        expect.any(Number),
        { surface: "media.upload", status: 204 },
      );
      expect(capture).not.toHaveBeenCalled();
    });

    it("records api.error + captures network class on throw and rethrows", async () => {
      const boom = new TypeError("fetch failed");
      vi.stubGlobal("fetch", vi.fn(async () => { throw boom; }));

      await expect(
        instrumentedFetch("http://x/y", undefined, { surface: "media.upload" }),
      ).rejects.toBe(boom);

      expect(increment).toHaveBeenCalledWith(
        M.apiError,
        { surface: "media.upload", class: "network" },
      );
      expect(capture).toHaveBeenCalledWith(boom, { errorClass: "network", handled: false });
    });

    it("defaults surface to 'fetch' when meta is absent", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
      await instrumentedFetch("http://x/y");
      expect(histogram).toHaveBeenCalledWith(
        M.apiDuration,
        expect.any(Number),
        { surface: "fetch", status: 200 },
      );
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test src/services/observability/server-fetch.test.ts`. Expect failure: `Failed to resolve import "./server-fetch"` / `instrumentedFetch is not a function`.

- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/server-fetch.ts`:
  ```ts
  // src/services/observability/server-fetch.ts
  // Общая инструментованная обёртка над raw fetch: ставит X-Request-Id из
  // серверного контекста, меряет длительность и пишет api.duration / api.error.
  import "server-only";

  import { getServerContext } from "./context/server";
  import { errors, metrics } from "./core/facade";
  import { M } from "./core/names";

  /**
   * Оборачивает raw fetch. `surface` — стабильный логический идентификатор места
   * вызова (media.upload, export.proxy, …): схема пути не известна, поэтому
   * метку route заменяет surface. Тело запроса НЕ читается (multipart-safe).
   */
  export async function instrumentedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    meta?: { surface: string },
  ): Promise<Response> {
    const surface = meta?.surface ?? "fetch";
    const requestId = getServerContext().requestId;

    const headers = new Headers(init?.headers);
    if (requestId) headers.set("X-Request-Id", requestId);
    const finalInit: RequestInit = { ...init, headers };

    const start = Date.now();
    try {
      const res = await fetch(input, finalInit);
      metrics.histogram(M.apiDuration, Date.now() - start, {
        surface,
        status: res.status,
      });
      return res;
    } catch (e) {
      metrics.increment(M.apiError, { surface, class: "network" });
      errors.capture(e, { errorClass: "network", handled: false });
      throw e;
    }
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test src/services/observability/server-fetch.test.ts`. Expect 3 passing.

- [ ] **Step 5: Commit.**
  ```
  git add src/services/observability/server-fetch.ts src/services/observability/server-fetch.test.ts && git commit -m "feat(observability): shared instrumentedFetch wrapper for raw fetch surfaces

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2.2: openapi-fetch middleware in both API clients

**Files:**
- Modify `src/api/client.ts` (add `.use(...)` to `createApiClient` return at lines 13-16 and `createPublicApiClient` return at lines 21-23; new import block)
- Create `src/api/client.test.ts`

**Interfaces:**
- Consumes: `getServerContext()` from `@/services/observability/context/server`; `metrics`, `errors` from `@/services/observability/core/facade`; `M` from `@/services/observability/core/names`.
- Produces: unchanged `createApiClient(): Promise<Client<paths>>`, `createPublicApiClient(): Client<paths>` — same signatures, now carrying an observability middleware.

- [ ] **Step 1: Write the FAILING test.** Create `src/api/client.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  vi.mock("next/headers", () => ({
    cookies: async () => ({ get: () => undefined }),
  }));

  vi.mock("@/services/observability/context/server", () => ({
    getServerContext: () => ({
      env: "test", runtime: "server", release: null,
      requestId: "req-mw", sessionId: null, route: null,
      actorHash: null, actorRole: null,
    }),
  }));

  const histogram = vi.fn();
  const increment = vi.fn();
  const capture = vi.fn();
  vi.mock("@/services/observability/core/facade", () => ({
    metrics: {
      histogram: (...a: unknown[]) => histogram(...a),
      increment: (...a: unknown[]) => increment(...a),
      startTimer: () => () => {},
    },
    errors: { capture: (...a: unknown[]) => capture(...a) },
  }));

  import { createPublicApiClient } from "./client";
  import { M } from "@/services/observability/core/names";

  describe("api client observability middleware", () => {
    beforeEach(() => {
      histogram.mockClear();
      increment.mockClear();
      capture.mockClear();
    });

    it("stamps X-Request-Id and emits api.duration with templated route", async () => {
      let seenHeader: string | null = null;
      vi.stubGlobal("fetch", vi.fn(async (req: Request) => {
        seenHeader = req.headers.get("X-Request-Id");
        return new Response(JSON.stringify({ data: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }));

      const api = createPublicApiClient();
      await api.GET("/api/annotations/{id}", { params: { path: { id: "a1" } } });

      expect(seenHeader).toBe("req-mw");
      expect(histogram).toHaveBeenCalledWith(
        M.apiDuration,
        expect.any(Number),
        { method: "GET", route: "/api/annotations/{id}", status: 200 },
      );
    });

    it("emits api.error + captures network on transport throw", async () => {
      const boom = new TypeError("fetch failed");
      vi.stubGlobal("fetch", vi.fn(async () => { throw boom; }));

      const api = createPublicApiClient();
      await api.GET("/api/annotations/{id}", { params: { path: { id: "a1" } } })
        .catch(() => undefined);

      expect(increment).toHaveBeenCalledWith(
        M.apiError,
        { method: "GET", route: "/api/annotations/{id}", class: "network" },
      );
      expect(capture).toHaveBeenCalledWith(boom, { errorClass: "network", handled: false });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test src/api/client.test.ts`. Expect failure: `expected "histogram" to be called with arguments` (no middleware registered yet — `histogram` never called).

- [ ] **Step 3: Minimal implementation.** Replace the full contents of `src/api/client.ts`:
  ```ts
  import createClient, { type Middleware } from "openapi-fetch";

  import { getServerContext } from "@/services/observability/context/server";
  import { errors, metrics } from "@/services/observability/core/facade";
  import { M } from "@/services/observability/core/names";

  import type { paths } from "./schema";

  export const API_URL = process.env.API_URL ?? "http://localhost:8080";

  // Длительность запроса меряется по id middleware-вызова: openapi-fetch гарантирует
  // парность onRequest/onResponse/onError с одним и тем же params.id.
  const startedAt = new Map<string, number>();

  /** Наблюдаемость для обоих openapi-клиентов: X-Request-Id + api.duration / api.error. */
  const observability: Middleware = {
    onRequest({ request, id }) {
      const requestId = getServerContext().requestId;
      if (requestId) request.headers.set("X-Request-Id", requestId);
      startedAt.set(id, Date.now());
      return request;
    },
    onResponse({ request, response, schemaPath, id }) {
      const start = startedAt.get(id);
      startedAt.delete(id);
      metrics.histogram(M.apiDuration, start === undefined ? 0 : Date.now() - start, {
        method: request.method,
        route: schemaPath,
        status: response.status,
      });
      return response;
    },
    onError({ request, schemaPath, error, id }) {
      startedAt.delete(id);
      metrics.increment(M.apiError, {
        method: request.method,
        route: schemaPath,
        class: "network",
      });
      errors.capture(error, { errorClass: "network", handled: false });
    },
  };

  /** Серверный клиент — автоматически прикладывает JWT из cookie */
  export async function createApiClient() {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    const client = createClient<paths>({
      baseUrl: API_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    client.use(observability);
    return client;
  }

  /** Публичный клиент без токена — для открытых эндпоинтов */
  export function createPublicApiClient() {
    const client = createClient<paths>({
      baseUrl: API_URL,
    });
    client.use(observability);
    return client;
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test src/api/client.test.ts`. Expect 2 passing.

- [ ] **Step 5: Commit.**
  ```
  git add src/api/client.ts src/api/client.test.ts && git commit -m "feat(observability): instrument openapi-fetch clients with request-id + api metrics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2.3: Count mutation commits in `revalidateEntity`

**Files:**
- Modify `src/utils/revalidate.ts` (add import; instrument body at lines 13-18)
- Create `src/utils/revalidate.test.ts`

**Interfaces:**
- Consumes: `metrics` from `@/services/observability/core/facade`; `M` from `@/services/observability/core/names`.
- Produces: unchanged `revalidateEntity(entity: string, id?: string): void`.

- [ ] **Step 1: Write the FAILING test.** Create `src/utils/revalidate.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  const revalidateTag = vi.fn();
  vi.mock("next/cache", () => ({
    revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  }));

  const increment = vi.fn();
  vi.mock("@/services/observability/core/facade", () => ({
    metrics: { increment: (...a: unknown[]) => increment(...a) },
  }));

  import { revalidateEntity } from "./revalidate";
  import { M } from "@/services/observability/core/names";

  describe("revalidateEntity", () => {
    beforeEach(() => {
      revalidateTag.mockClear();
      increment.mockClear();
    });

    it("increments mutation.commit{entity} and revalidates list tag", () => {
      revalidateEntity("documents");
      expect(increment).toHaveBeenCalledWith(M.mutationCommit, { entity: "documents" });
      expect(revalidateTag).toHaveBeenCalledWith("documents", "default");
      expect(revalidateTag).toHaveBeenCalledTimes(1);
    });

    it("also revalidates item tag when id is given (single mutation count)", () => {
      revalidateEntity("documents", "d1");
      expect(increment).toHaveBeenCalledTimes(1);
      expect(increment).toHaveBeenCalledWith(M.mutationCommit, { entity: "documents" });
      expect(revalidateTag).toHaveBeenCalledWith("documents:d1", "default");
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test src/utils/revalidate.test.ts`. Expect failure: `expected "increment" to be called with arguments` (increment never called).

- [ ] **Step 3: Minimal implementation.** Edit `src/utils/revalidate.ts`. Add imports after the `revalidateTag` import:
  ```ts
  import { metrics } from "@/services/observability/core/facade";
  import { M } from "@/services/observability/core/names";
  ```
  Add the increment as the first line of the function body (before `revalidateTag(entity, "default")`):
  ```ts
    // Объём успешных мутаций по сущности (commit засчитывается ровно один раз).
    metrics.increment(M.mutationCommit, { entity });
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test src/utils/revalidate.test.ts`. Expect 2 passing.

- [ ] **Step 5: Commit.**
  ```
  git add src/utils/revalidate.ts src/utils/revalidate.test.ts && git commit -m "feat(observability): count mutation.commit in revalidateEntity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2.4: Route simple raw-fetch surfaces through `instrumentedFetch`

Threads `me.ts` (/api/me — already P1-timed for auth.resolve; here only add X-Request-Id + api timing), `auth/actions.ts` (3 sites), `annotations/api.ts` (per-entity list), `annotations/actions.ts` (create), `export-proxy.ts` through `instrumentedFetch`.

**Files:**
- Modify `src/utils/me.ts` (replace `fetch` at line 54 with `instrumentedFetch`; add import)
- Modify `src/features/auth/actions.ts` (replace `fetch` at lines 36, 75, 123; add import)
- Modify `src/features/annotations/api.ts` (replace `fetch` at line 55; add import)
- Modify `src/features/annotations/actions.ts` (replace `fetch` at line 70; add import)
- Modify `src/utils/export-proxy.ts` (replace `fetch` at line 31; add import)
- Create `src/features/auth/actions.fetch.test.ts`

**Interfaces:**
- Consumes: `instrumentedFetch(input, init?, meta?: { surface: string })` from `@/services/observability/server-fetch`.
- Produces: behavior of each surface unchanged (status mapping intact); now carries `surface` metric tag + X-Request-Id.

- [ ] **Step 1: Write the FAILING test.** Create `src/features/auth/actions.fetch.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  const cookieStore = { get: vi.fn(() => undefined) };
  vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

  const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
  vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

  vi.mock("./cookie", () => ({
    setAuthCookie: vi.fn(async () => undefined),
    clearAuthCookie: vi.fn(async () => undefined),
    getAuthToken: vi.fn(async () => undefined),
  }));

  const instrumentedFetch = vi.fn();
  vi.mock("@/services/observability/server-fetch", () => ({
    instrumentedFetch: (...a: unknown[]) => instrumentedFetch(...a),
  }));

  import { loginAction } from "./actions";

  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  describe("loginAction transport", () => {
    beforeEach(() => {
      instrumentedFetch.mockReset();
      redirect.mockClear();
    });

    it("calls instrumentedFetch with surface auth.login and succeeds", async () => {
      instrumentedFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 }),
      );
      await expect(
        loginAction(undefined, form({ username: "neo", password: "trinity99", next: "/" })),
      ).resolves.toBeDefined();

      const meta = instrumentedFetch.mock.calls[0]![2] as { surface: string };
      expect(meta.surface).toBe("auth.login");
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test src/features/auth/actions.fetch.test.ts`. Expect failure: `expected 'fetch' to be 'auth.login'` (actual still global `fetch`, mock not called → `Cannot read properties of undefined (reading '2')`).

- [ ] **Step 3: Minimal implementation.** Apply each surface:

  In `src/utils/me.ts`, add after the `import { cache } from "react";` line:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the `fetch` call at line 54:
  ```ts
    const res = await instrumentedFetch(
      `${API_URL}/api/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
      { surface: "me.resolve" },
    );
  ```

  In `src/features/auth/actions.ts`, add after the `import { redirect } from "next/navigation";` line:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the login `fetch` (line 36):
  ```ts
      res = await instrumentedFetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      }, { surface: "auth.login" });
  ```
  Replace the register `fetch` (line 75):
  ```ts
      res = await instrumentedFetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      }, { surface: "auth.register" });
  ```
  Replace the logout `fetch` (line 123):
  ```ts
        await instrumentedFetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        }, { surface: "auth.logout" });
  ```

  In `src/features/annotations/api.ts`, add after the `import { cache } from "react";` line:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the per-entity list `fetch` (line 55):
  ```ts
      const res = await instrumentedFetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      }, { surface: "annotations.list" });
  ```

  In `src/features/annotations/actions.ts`, add after the `import { cookies } from "next/headers";` line:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the create `fetch` (line 70):
  ```ts
    const res = await instrumentedFetch(
      `${API_URL}/api/${seg}/${encodeURIComponent(input.parent_entity_id)}/annotations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...idempotencyHeaders(ctx.idempotencyKey),
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
      { surface: "annotations.create" },
    );
  ```

  In `src/utils/export-proxy.ts`, add after the `import { API_URL } from "@/api/client";` line:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the proxy `fetch` (line 31):
  ```ts
    const upstream = await instrumentedFetch(`${API_URL}${upstreamPath(id, format)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    }, { surface: "export.proxy" });
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test src/features/auth/actions.fetch.test.ts`. Expect 1 passing.

- [ ] **Step 5: Commit.**
  ```
  git add src/utils/me.ts src/features/auth/actions.ts src/features/annotations/api.ts src/features/annotations/actions.ts src/utils/export-proxy.ts src/features/auth/actions.fetch.test.ts && git commit -m "feat(obs): route simple raw-fetch surfaces through instrumentedFetch

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2.5: Route multipart upload surfaces through `instrumentedFetch`

Uploads pass `FormData` as `body` and MUST NOT be re-read — `instrumentedFetch` never touches the body, so it is multipart-safe. Threads `media/upload-media.ts`, `ast-editor/upload/upload-image.ts`, `documents/actions.ts` (uploadDocument).

**Files:**
- Modify `src/features/media/upload-media.ts` (replace `fetch` at line 62; add import)
- Modify `src/components/ast-editor/upload/upload-image.ts` (replace `fetch` at line 32; add import)
- Modify `src/features/documents/actions.ts` (replace `fetch` at line 100; add import)
- Create `src/features/media/upload-media.test.ts`

**Interfaces:**
- Consumes: `instrumentedFetch(input, init?, meta?: { surface: string })` from `@/services/observability/server-fetch`.
- Produces: `uploadMedia(formData)`, `uploadImage(formData)`, `uploadDocument` unchanged; FormData body passed through untouched.

- [ ] **Step 1: Write the FAILING test.** Create `src/features/media/upload-media.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  vi.mock("next/headers", () => ({
    cookies: async () => ({ get: () => undefined }),
  }));

  vi.mock("@/utils/me", () => ({ getMe: async () => ({ id: "u1", status: "active" }) }));
  vi.mock("./permissions", () => ({ canCreateMedia: () => true }));
  vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

  const instrumentedFetch = vi.fn();
  vi.mock("@/services/observability/server-fetch", () => ({
    instrumentedFetch: (...a: unknown[]) => instrumentedFetch(...a),
  }));

  import { uploadMedia } from "./upload-media";

  describe("uploadMedia transport", () => {
    beforeEach(() => instrumentedFetch.mockReset());

    it("passes FormData body untouched with surface media.upload", async () => {
      instrumentedFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "m1" } }), { status: 201 }),
      );
      const fd = new FormData();
      fd.set("file", new File(["x"], "v.mp4", { type: "video/mp4" }));
      fd.set("type", "video");

      const result = await uploadMedia(fd);

      expect(result).toEqual({ success: true, data: { id: "m1" } });
      const [, init, meta] = instrumentedFetch.mock.calls[0]!;
      expect((init as RequestInit).body).toBe(fd);
      expect(meta).toEqual({ surface: "media.upload" });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test src/features/media/upload-media.test.ts`. Expect failure: mock not invoked → `Cannot destructure property ... of 'instrumentedFetch.mock.calls[0]' as it is undefined`.

- [ ] **Step 3: Minimal implementation.** Apply each surface:

  In `src/features/media/upload-media.ts`, add after `import { revalidateEntity } from "@/utils/revalidate";`:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the `fetch` (line 62):
  ```ts
      res = await instrumentedFetch(`${API_URL}/api/media`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }, { surface: "media.upload" });
  ```

  In `src/components/ast-editor/upload/upload-image.ts`, add after `import { cookies } from "next/headers";`:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the `fetch` (line 32):
  ```ts
      res = await instrumentedFetch(`${API_URL}/api/uploads/images`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }, { surface: "image.upload" });
  ```

  In `src/features/documents/actions.ts`, add after `import { revalidateEntity } from "@/utils/revalidate";`:
  ```ts
  import { instrumentedFetch } from "@/services/observability/server-fetch";
  ```
  Replace the `fetch` (line 100):
  ```ts
      res = await instrumentedFetch(`${API_URL}/api/documents/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: upstream,
      }, { surface: "document.upload" });
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test src/features/media/upload-media.test.ts`. Expect 1 passing.

- [ ] **Step 5: Commit.**
  ```
  git add src/features/media/upload-media.ts src/components/ast-editor/upload/upload-image.ts src/features/documents/actions.ts src/features/media/upload-media.test.ts && git commit -m "feat(obs): instrument multipart upload surfaces (body-safe instrumentedFetch)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2.6: Next instrumentation hook (`register` + `onRequestError`)

**Files:**
- Create `instrumentation.ts` (REPO ROOT)
- Create `instrumentation.test.ts` (REPO ROOT)

**Interfaces:**
- Consumes: `initServerObservability()` from `@/services/observability`; `errors` from `@/services/observability/core/facade`.
- Produces: `export function register(): void`; `export function onRequestError(error: unknown, request: { path: string; method: string; headers: Record<string, string> }, context: { routerKind: string; routePath: string; routeType: string; renderSource: string; revalidateReason: string | undefined }): void`.

- [ ] **Step 1: Write the FAILING test.** Create `instrumentation.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  const initServerObservability = vi.fn();
  vi.mock("@/services/observability", () => ({
    initServerObservability: () => initServerObservability(),
  }));

  const capture = vi.fn();
  vi.mock("@/services/observability/core/facade", () => ({
    errors: { capture: (...a: unknown[]) => capture(...a) },
  }));

  import { register, onRequestError } from "./instrumentation";

  describe("instrumentation", () => {
    beforeEach(() => {
      initServerObservability.mockClear();
      capture.mockClear();
    });

    it("register boots server observability", () => {
      register();
      expect(initServerObservability).toHaveBeenCalledTimes(1);
    });

    it("onRequestError captures unhandled error with route + renderSource attrs", () => {
      const err = new Error("boom");
      onRequestError(
        err,
        { path: "/x", method: "GET", headers: {} },
        {
          routerKind: "App Router",
          routePath: "/documents/[id]",
          routeType: "render",
          renderSource: "react-server-components",
          revalidateReason: undefined,
        },
      );
      expect(capture).toHaveBeenCalledWith(err, {
        handled: false,
        attributes: {
          route: "/documents/[id]",
          renderSource: "react-server-components",
        },
      });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test instrumentation.test.ts`. Expect failure: `Failed to resolve import "./instrumentation"`.

- [ ] **Step 3: Minimal implementation.** Create `instrumentation.ts` at the repo root:
  ```ts
  // instrumentation.ts
  // Next 16 instrumentation hook: бутстрап серверной наблюдаемости при старте
  // процесса и единая точка перехвата необработанных ошибок рендера/роутинга.
  import { initServerObservability } from "@/services/observability";
  import { errors } from "@/services/observability/core/facade";

  /** Вызывается Next один раз при инициализации серверного рантайма. */
  export function register(): void {
    initServerObservability();
  }

  /**
   * Сигнатура Next 16: onRequestError(error, request, context).
   * Все ошибки здесь — необработанные (handled: false). Метку route и источник
   * рендера прокидываем атрибутами для группировки.
   */
  export function onRequestError(
    error: unknown,
    _request: { path: string; method: string; headers: Record<string, string> },
    context: {
      routerKind: string;
      routePath: string;
      routeType: string;
      renderSource: string;
      revalidateReason: string | undefined;
    },
  ): void {
    errors.capture(error, {
      handled: false,
      attributes: {
        route: context.routePath,
        renderSource: context.renderSource,
      },
    });
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test instrumentation.test.ts`. Expect 2 passing.

- [ ] **Step 5: Commit.**
  ```
  git add instrumentation.ts instrumentation.test.ts && git commit -m "feat(observability): Next register hook + onRequestError capture

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2.7: Route same-origin offline transports through `instrumentedFetch` is N/A — these are CLIENT surfaces; thread them via a thin timing wrapper instead

The offline `transport.ts` and `store/images.ts` run in the browser, where `instrumentedFetch` (`server-only`) cannot import. Instead, count drain volume server-agnostically using the client facade's metrics at the offline call sites.

**Files:**
- Modify `src/app/_offline/transport.ts` (wrap the `fetch` at line 13 with timing; add import)
- Create `src/app/_offline/transport.test.ts`

**Interfaces:**
- Consumes: `metrics` from `@/services/observability/core/facade`; `M` from `@/services/observability/core/names`.
- Produces: unchanged `offlineTransport: SyncTransport`; now emits `M.apiDuration{surface:"offline.transport",status}` and `M.apiError{surface:"offline.transport",class:"network"}` on throw.

- [ ] **Step 1: Write the FAILING test.** Create `src/app/_offline/transport.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  const histogram = vi.fn();
  const increment = vi.fn();
  vi.mock("@/services/observability/core/facade", () => ({
    metrics: {
      histogram: (...a: unknown[]) => histogram(...a),
      increment: (...a: unknown[]) => increment(...a),
    },
  }));

  import { offlineTransport } from "./transport";
  import { M } from "@/services/observability/core/names";

  const cmd = {
    clientId: "c1",
    entity: "annotation",
    op: "create",
    payload: { x: 1 },
  } as unknown as Parameters<typeof offlineTransport>[0];

  describe("offlineTransport observability", () => {
    beforeEach(() => {
      histogram.mockClear();
      increment.mockClear();
    });

    it("records api.duration on success", async () => {
      vi.stubGlobal("fetch", vi.fn(async () =>
        new Response(JSON.stringify({ data: { id: "s1" } }), { status: 200 }),
      ));
      const res = await offlineTransport(cmd);
      expect(res).toEqual({ ok: true, serverId: "s1" });
      expect(histogram).toHaveBeenCalledWith(
        M.apiDuration,
        expect.any(Number),
        { surface: "offline.transport", status: 200 },
      );
    });

    it("records api.error and rethrows on network throw", async () => {
      const boom = new TypeError("fetch failed");
      vi.stubGlobal("fetch", vi.fn(async () => { throw boom; }));
      await expect(offlineTransport(cmd)).rejects.toBe(boom);
      expect(increment).toHaveBeenCalledWith(
        M.apiError,
        { surface: "offline.transport", class: "network" },
      );
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test src/app/_offline/transport.test.ts`. Expect failure: `expected "histogram" to be called with arguments` (not yet instrumented).

- [ ] **Step 3: Minimal implementation.** Edit `src/app/_offline/transport.ts`. Add imports after the existing type imports block (after the `} from "@/services/offline/sync/transport";` line):
  ```ts
  import { metrics } from "@/services/observability/core/facade";
  import { M } from "@/services/observability/core/names";
  ```
  Replace the `fetch` call (lines 13-22) with a timed wrapper:
  ```ts
    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(`/api/offline/${command.entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          clientId: command.clientId,
          op: command.op,
          payload: command.payload,
        }),
      });
    } catch (e) {
      metrics.increment(M.apiError, { surface: "offline.transport", class: "network" });
      throw e;
    }
    metrics.histogram(M.apiDuration, Date.now() - start, {
      surface: "offline.transport",
      status: res.status,
    });
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test src/app/_offline/transport.test.ts`. Expect 2 passing.

- [ ] **Step 5: Commit.**
  ```
  git add src/app/_offline/transport.ts src/app/_offline/transport.test.ts && git commit -m "feat(obs): time offline transport via client metrics facade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2.8: Time offline image cache fetch (`store/images.ts`)

`cacheImage` does a browser `fetch` of a static asset; time it via the client facade so cache-fill latency/failures are visible. Body is a binary asset — never read here.

**Files:**
- Modify `src/services/offline/store/images.ts` (wrap the `fetch` in `cacheImage` at line 11; add import)
- Modify `src/services/offline/store/images.test.ts` (add observability cases)

**Interfaces:**
- Consumes: `metrics` from `@/services/observability/core/facade`; `M` from `@/services/observability/core/names`.
- Produces: unchanged `cacheImage(url: string): Promise<boolean>`; emits `M.apiDuration{surface:"offline.image",status}` on response and `M.apiError{surface:"offline.image",class:"network"}` on throw.

- [ ] **Step 1: Write the FAILING test.** Add to `src/services/offline/store/images.test.ts` a new block (append after existing imports/describe; if the facade is not yet mocked there, add the mock at top). Insert this self-contained describe and its mocks at the end of the file:
  ```ts
  import { describe as describeObs, it as itObs, expect as expectObs, vi as viObs, beforeEach as beforeEachObs } from "vitest";

  const obsHistogram = viObs.fn();
  const obsIncrement = viObs.fn();
  viObs.mock("@/services/observability/core/facade", () => ({
    metrics: {
      histogram: (...a: unknown[]) => obsHistogram(...a),
      increment: (...a: unknown[]) => obsIncrement(...a),
    },
  }));

  describeObs("cacheImage observability", () => {
    beforeEachObs(() => {
      obsHistogram.mockClear();
      obsIncrement.mockClear();
      viObs.stubGlobal("caches", {
        open: async () => ({ put: async () => undefined }),
      });
    });

    itObs("records api.duration on cached fetch", async () => {
      viObs.stubGlobal("fetch", viObs.fn(async () => new Response("img", { status: 200 })));
      const { cacheImage } = await import("./images");
      const { M } = await import("@/services/observability/core/names");
      const ok = await cacheImage("/static/files/a.png");
      expectObs(ok).toBe(true);
      expectObs(obsHistogram).toHaveBeenCalledWith(
        M.apiDuration,
        expectObs.any(Number),
        { surface: "offline.image", status: 200 },
      );
    });

    itObs("records api.error and rethrows on network throw", async () => {
      const boom = new TypeError("fetch failed");
      viObs.stubGlobal("fetch", viObs.fn(async () => { throw boom; }));
      const { cacheImage } = await import("./images");
      const { M } = await import("@/services/observability/core/names");
      await expectObs(cacheImage("/static/files/a.png")).rejects.toBe(boom);
      expectObs(obsIncrement).toHaveBeenCalledWith(
        M.apiError,
        { surface: "offline.image", class: "network" },
      );
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** Run `pnpm test src/services/offline/store/images.test.ts`. Expect failure: `expected "obsHistogram" to be called with arguments` (cacheImage not yet instrumented).

- [ ] **Step 3: Minimal implementation.** Edit `src/services/offline/store/images.ts`. Add imports after the existing `} from "../contract/storage";` line:
  ```ts
  import { metrics } from "@/services/observability/core/facade";
  import { M } from "@/services/observability/core/names";
  ```
  Replace the body of `cacheImage`:
  ```ts
  export async function cacheImage(url: string): Promise<boolean> {
    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { credentials: "same-origin" });
    } catch (e) {
      metrics.increment(M.apiError, { surface: "offline.image", class: "network" });
      throw e;
    }
    metrics.histogram(M.apiDuration, Date.now() - start, {
      surface: "offline.image",
      status: res.status,
    });
    if (!res.ok) return false;
    const cache = await caches.open(OFFLINE_IMAGE_CACHE);
    await cache.put(url, res);
    return true;
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** Run `pnpm test src/services/offline/store/images.test.ts`. Expect the new 2 cases passing alongside the existing suite.

- [ ] **Step 5: Commit.**
  ```
  git add src/services/offline/store/images.ts src/services/offline/store/images.test.ts && git commit -m "feat(obs): time offline image cache fetch via client metrics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```


---

## Phase 3: Client Telemetry

Goal: surface client-side errors from App-Router boundaries and `window` handlers, report web-vitals via Next's `useReportWebVitals`, and accept a same-origin telemetry batch at `/api/telemetry` that re-redacts and re-emits into the active server sink.

### Task 3.1: Shared boundary-reporting hook

**Files:**
- Create `src/services/observability/use-report-boundary-error.ts`
- Create `src/services/observability/use-report-boundary-error.test.tsx`

**Interfaces:**
- Consumes: `errors` from `./client` (client-safe barrel) — `errors.capture(error: unknown, options?: { handled?: boolean; attributes?: Attributes })`.
- Produces: `export function useReportBoundaryError(error: Error & { digest?: string }): void` — на маунте/смене `error` зовёт `errors.capture(error, { handled: false, attributes: { digest: error.digest ?? null } })`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/use-report-boundary-error.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
  import { render, cleanup } from "@testing-library/react";

  const capture = vi.fn();
  vi.mock("./client", () => ({ errors: { capture } }));

  import { useReportBoundaryError } from "./use-report-boundary-error";

  function Probe({ error }: { error: Error & { digest?: string } }) {
    useReportBoundaryError(error);
    return null;
  }

  afterEach(cleanup);
  beforeEach(() => capture.mockClear());

  describe("useReportBoundaryError", () => {
    it("captures the error as unhandled with its digest", () => {
      const err = Object.assign(new Error("boom"), { digest: "d-42" });
      render(<Probe error={err} />);
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledWith(err, {
        handled: false,
        attributes: { digest: "d-42" },
      });
    });

    it("passes digest as null when absent", () => {
      const err = new Error("no-digest") as Error & { digest?: string };
      render(<Probe error={err} />);
      expect(capture).toHaveBeenCalledWith(err, {
        handled: false,
        attributes: { digest: null },
      });
    });

    it("re-captures when the error identity changes", () => {
      const a = Object.assign(new Error("a"), { digest: "a" });
      const b = Object.assign(new Error("b"), { digest: "b" });
      const { rerender } = render(<Probe error={a} />);
      rerender(<Probe error={b} />);
      expect(capture).toHaveBeenCalledTimes(2);
      expect(capture).toHaveBeenLastCalledWith(b, {
        handled: false,
        attributes: { digest: "b" },
      });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/observability/use-report-boundary-error.test.tsx` — fails: `Failed to resolve import "./use-report-boundary-error"` (module does not exist yet).

- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/use-report-boundary-error.ts`:
  ```ts
  "use client";

  // Хук для App-Router error-boundary: репортит словленную React'ом ошибку
  // как unhandled, с digest из Next. Импортит client-safe barrel (не server-only).
  import { useEffect } from "react";

  import { errors } from "./client";

  export function useReportBoundaryError(error: Error & { digest?: string }): void {
    useEffect(() => {
      errors.capture(error, {
        handled: false,
        attributes: { digest: error.digest ?? null },
      });
    }, [error]);
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/services/observability/use-report-boundary-error.test.tsx` — 3 passing.

- [ ] **Step 5: Commit.** `git add src/services/observability/use-report-boundary-error.ts src/services/observability/use-report-boundary-error.test.tsx && git commit -m "feat(observability): add useReportBoundaryError hook for App-Router boundaries

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.2: Wire the hook into RouteError + GlobalError

**Files:**
- Modify `src/app/_components/route-error.tsx` (currently destructures only `reset` at L5-10, ignores `error`)
- Modify `src/app/global-error.tsx` (currently destructures only `reset` at L3-8, ignores `error`)
- Modify `src/app/error-boundaries.test.tsx` (add boundary-capture assertions; existing tests at L45-120)

**Interfaces:**
- Consumes: `useReportBoundaryError(error)` from `@/services/observability/use-report-boundary-error`.
- Produces: same static fallback UI, now with a side-effect call to `errors.capture` on mount. Per-segment `error.tsx` (trails/search/glossary/documents/lectures) and root `error.tsx` delegate to `RouteError`, so they inherit reporting; `admin/error.tsx` renders its own UI and is wired separately in Task 3.3.

- [ ] **Step 1: Write the FAILING test.** Add a new `describe` block to `src/app/error-boundaries.test.tsx` (append after the existing `NotFound` block, before EOF). First add a mock near the top of the file (right after the `next/navigation` mock at L25):
  ```tsx
  const captureBoundary = vi.fn();
  vi.mock("@/services/observability/use-report-boundary-error", () => ({
    useReportBoundaryError: (error: unknown) => captureBoundary(error),
  }));
  ```
  Then append this block at the bottom of the file:
  ```tsx
  // ---------------------------------------------------------------------------
  // Boundary error reporting — RouteError + GlobalError forward `error` to the
  // observability hook on mount (handled:false capture happens inside the hook).
  // ---------------------------------------------------------------------------
  describe("boundary error reporting", () => {
    afterEach(() => captureBoundary.mockClear());

    it("RouteError reports the error on mount", () => {
      render(<RouteError error={stubError} reset={vi.fn()} />);
      expect(captureBoundary).toHaveBeenCalledWith(stubError);
    });

    it("GlobalError reports the error on mount", () => {
      render(<GlobalError error={stubError} reset={vi.fn()} />);
      expect(captureBoundary).toHaveBeenCalledWith(stubError);
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/app/error-boundaries.test.tsx` — the two new cases fail: `expected "spy" to be called with arguments: [ [Error: boom] ]` (boundaries don't call the hook yet).

- [ ] **Step 3: Minimal implementation.** Replace the body of `src/app/_components/route-error.tsx`:
  ```tsx
  "use client";

  import { Button } from "@/components/ui";
  import { useReportBoundaryError } from "@/services/observability/use-report-boundary-error";

  export default function RouteError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useReportBoundaryError(error);
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-3xl font-bold">Что-то пошло не так</h1>
        <p className="text-(--color-description)">
          Произошла ошибка при загрузке страницы.
        </p>
        <Button variant="secondary" onClick={reset}>
          Попробовать снова
        </Button>
      </div>
    );
  }
  ```
  Replace the signature + first line of `src/app/global-error.tsx` (add the import after the `"use client"` line, add `error` to the destructure, call the hook before `return`):
  ```tsx
  "use client";

  import { useReportBoundaryError } from "@/services/observability/use-report-boundary-error";

  export default function GlobalError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useReportBoundaryError(error);
    return (
      <html lang="ru">
        <body>
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              padding: "1rem",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
              Что-то пошло не так
            </h1>
            <p style={{ margin: 0, color: "#6b7280" }}>
              Произошла критическая ошибка. Попробуйте обновить страницу.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                background: "transparent",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Повторить
            </button>
          </div>
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/app/error-boundaries.test.tsx` — all cases pass (existing UI/reset tests still green; 2 new capture cases green).

- [ ] **Step 5: Commit.** `git add src/app/_components/route-error.tsx src/app/global-error.tsx src/app/error-boundaries.test.tsx && git commit -m "feat(observability): report App-Router boundary errors via useReportBoundaryError

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.3: Wire the hook into AdminError

**Files:**
- Modify `src/app/admin/error.tsx` (own UI, currently destructures only `reset` at L3-9)
- Modify `src/app/error-boundaries.test.tsx` (extend the boundary-reporting block from Task 3.2)

**Interfaces:**
- Consumes: `useReportBoundaryError(error)`.
- Produces: unchanged Admin fallback UI + on-mount capture. Note: Admin's `error` prop type was `Error` (no digest) — widen to `Error & { digest?: string }` to match the hook signature.

- [ ] **Step 1: Write the FAILING test.** Add to the `boundary error reporting` describe block in `src/app/error-boundaries.test.tsx`:
  ```tsx
    it("AdminError reports the error on mount", () => {
      render(<AdminError error={stubError} reset={vi.fn()} />);
      expect(captureBoundary).toHaveBeenCalledWith(stubError);
    });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/app/error-boundaries.test.tsx` — fails: `expected "spy" to be called with arguments: [ [Error: boom] ]` (AdminError ignores `error`).

- [ ] **Step 3: Minimal implementation.** Replace `src/app/admin/error.tsx`:
  ```tsx
  // src/app/admin/error.tsx
  "use client";

  import { useReportBoundaryError } from "@/services/observability/use-report-boundary-error";

  export default function AdminError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useReportBoundaryError(error);
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-(--color-border) px-3 py-1 text-sm"
        >
          Попробовать снова
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/app/error-boundaries.test.tsx` — all green.

- [ ] **Step 5: Commit.** `git add src/app/admin/error.tsx src/app/error-boundaries.test.tsx && git commit -m "feat(observability): report admin boundary errors via useReportBoundaryError

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.4: WebVitalsReporter client component

**Files:**
- Create `src/services/observability/web-vitals-reporter.tsx`
- Create `src/services/observability/web-vitals-reporter.test.tsx`

**Interfaces:**
- Consumes: `useReportWebVitals` from `next/web-vitals` (Next built-in; metric is `{ name: string; value: number; rating: string }`); `metrics` from `./client`; `webVital` from `./core/names`.
- Produces: `export function WebVitalsReporter(): null` — на каждый web-vital шлёт `metrics.histogram(webVital(metric.name), metric.value, { rating: metric.rating })`.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/web-vitals-reporter.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
  import { render, cleanup } from "@testing-library/react";

  const histogram = vi.fn();
  vi.mock("./client", () => ({ metrics: { histogram } }));

  // Захватываем callback, который компонент передаёт в useReportWebVitals,
  // и сразу дёргаем его синтетической метрикой.
  let reportCb: ((m: { name: string; value: number; rating: string }) => void) | null = null;
  vi.mock("next/web-vitals", () => ({
    useReportWebVitals: (cb: (m: { name: string; value: number; rating: string }) => void) => {
      reportCb = cb;
    },
  }));

  import { WebVitalsReporter } from "./web-vitals-reporter";

  afterEach(cleanup);
  beforeEach(() => {
    histogram.mockClear();
    reportCb = null;
  });

  describe("WebVitalsReporter", () => {
    it("forwards a web-vital to metrics.histogram with prefixed name and rating", () => {
      render(<WebVitalsReporter />);
      expect(reportCb).toBeTypeOf("function");
      reportCb!({ name: "LCP", value: 1234.5, rating: "good" });
      expect(histogram).toHaveBeenCalledWith("web_vitals.LCP", 1234.5, {
        rating: "good",
      });
    });

    it("renders nothing", () => {
      const { container } = render(<WebVitalsReporter />);
      expect(container.firstChild).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/observability/web-vitals-reporter.test.tsx` — fails: `Failed to resolve import "./web-vitals-reporter"`.

- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/web-vitals-reporter.tsx`:
  ```tsx
  "use client";

  // Монтируется один раз в root-layout. Перекладывает Next web-vitals в metrics
  // как гистограммы web_vitals.<NAME> с rating-атрибутом. Client-safe barrel.
  import { useReportWebVitals } from "next/web-vitals";

  import { metrics } from "./client";
  import { webVital } from "./core/names";

  export function WebVitalsReporter(): null {
    useReportWebVitals((metric) => {
      metrics.histogram(webVital(metric.name), metric.value, {
        rating: metric.rating,
      });
    });
    return null;
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/services/observability/web-vitals-reporter.test.tsx` — 2 passing.

- [ ] **Step 5: Commit.** `git add src/services/observability/web-vitals-reporter.tsx src/services/observability/web-vitals-reporter.test.tsx && git commit -m "feat(observability): add WebVitalsReporter forwarding RUM into metrics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

> **Foundation touch (required, one line):** root layout `src/app/layout.tsx` is a FROZEN zone, so it cannot be edited inside this feature. The cleanest mount point — alongside the existing side-effect client components (`<OfflineIdentityGuard/>`, `<YandexMetrika/>`) already inside `<body>` — is one line: `import { WebVitalsReporter } from "@/services/observability/web-vitals-reporter";` plus `<WebVitalsReporter />` next to `<UpdatePrompt />`. This is the chosen approach over a side-effect-only `instrumentation-client.ts` listener because `useReportWebVitals` is a React hook and must run inside a mounted component. Land it as a separate foundation-update PR per CLAUDE.md; this plan does not modify `layout.tsx`. The component is fully tested in isolation above, so the foundation PR is a trivial mount + smoke-render.

### Task 3.5: instrumentation-client.ts — init + window handlers

**Files:**
- Create `instrumentation-client.ts` (REPO ROOT — Next.js client instrumentation entrypoint)
- Create `src/services/observability/instrumentation-client.test.ts`

**Interfaces:**
- Consumes: `initClientObservability` from `@/services/observability/client`; `errors` from `@/services/observability/client`.
- Produces: side-effect module — calls `initClientObservability()` once, then registers `window` `"error"` and `"unhandledrejection"` handlers that route to `errors.capture(..., { handled: false })`. To keep listener registration unit-testable without importing a root-level Next entry, the logic lives in a tested helper `export function registerClientErrorHandlers(target: Pick<Window, "addEventListener">): void` colocated in `src/services/observability/register-client-error-handlers.ts`; `instrumentation-client.ts` is a 4-line shim that calls init + the helper with `window` (the shim itself is not unit-tested — Next loads it; the helper carries the coverage).

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/instrumentation-client.test.ts` (tests the helper, not the root shim):
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  const capture = vi.fn();
  vi.mock("./client", () => ({
    errors: { capture },
    initClientObservability: vi.fn(),
  }));

  import { registerClientErrorHandlers } from "./register-client-error-handlers";

  type Handler = (ev: unknown) => void;

  function makeTarget() {
    const handlers = new Map<string, Handler>();
    return {
      handlers,
      addEventListener: (type: string, h: Handler) => handlers.set(type, h),
    };
  }

  beforeEach(() => capture.mockClear());

  describe("registerClientErrorHandlers", () => {
    it("registers error + unhandledrejection listeners", () => {
      const t = makeTarget();
      registerClientErrorHandlers(t);
      expect(t.handlers.has("error")).toBe(true);
      expect(t.handlers.has("unhandledrejection")).toBe(true);
    });

    it("captures window error events as unhandled with the underlying error", () => {
      const t = makeTarget();
      registerClientErrorHandlers(t);
      const err = new Error("window-boom");
      t.handlers.get("error")!({ error: err, message: "window-boom" });
      expect(capture).toHaveBeenCalledWith(err, { handled: false });
    });

    it("falls back to the event message when error is absent", () => {
      const t = makeTarget();
      registerClientErrorHandlers(t);
      t.handlers.get("error")!({ error: null, message: "msg-only" });
      expect(capture).toHaveBeenCalledWith("msg-only", { handled: false });
    });

    it("captures unhandled promise rejections via reason", () => {
      const t = makeTarget();
      registerClientErrorHandlers(t);
      const reason = new Error("rejected");
      t.handlers.get("unhandledrejection")!({ reason });
      expect(capture).toHaveBeenCalledWith(reason, { handled: false });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/observability/instrumentation-client.test.ts` — fails: `Failed to resolve import "./register-client-error-handlers"`.

- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/register-client-error-handlers.ts`:
  ```ts
  "use client";

  // Глобальные window-обработчики: необработанные ошибки и реджекты промисов
  // → errors.capture(handled:false). Вынесено из instrumentation-client.ts,
  // чтобы цель addEventListener можно было подставить в тестах.
  import { errors } from "./client";

  interface ErrorLikeEvent {
    error?: unknown;
    message?: string;
  }
  interface RejectionLikeEvent {
    reason?: unknown;
  }

  export function registerClientErrorHandlers(
    target: Pick<Window, "addEventListener">,
  ): void {
    target.addEventListener("error", (ev: Event) => {
      const e = ev as unknown as ErrorLikeEvent;
      errors.capture(e.error ?? e.message ?? "unknown error", {
        handled: false,
      });
    });
    target.addEventListener("unhandledrejection", (ev: Event) => {
      const e = ev as unknown as RejectionLikeEvent;
      errors.capture(e.reason ?? "unhandled rejection", { handled: false });
    });
  }
  ```
  Then create the root shim `instrumentation-client.ts` (REPO ROOT — loaded by Next, not unit-tested):
  ```ts
  // instrumentation-client.ts — Next.js client instrumentation entrypoint.
  // Инициализирует клиентскую observability и вешает глобальные обработчики
  // ошибок/реджектов. Логика — в @/services/observability (покрыта тестами).
  import {
    initClientObservability,
  } from "@/services/observability/client";
  import { registerClientErrorHandlers } from "@/services/observability/register-client-error-handlers";

  initClientObservability();
  registerClientErrorHandlers(window);
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/services/observability/instrumentation-client.test.ts` — 4 passing.

- [ ] **Step 5: Commit.** `git add src/services/observability/register-client-error-handlers.ts instrumentation-client.ts src/services/observability/instrumentation-client.test.ts && git commit -m "feat(observability): init client telemetry + global window error handlers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.6: Telemetry ingest validation (Zod schema + caps)

**Files:**
- Create `src/services/observability/ingest/validate.ts`
- Create `src/services/observability/ingest/validate.test.ts`

**Interfaces:**
- Consumes: `zod` (v4); `redactAttributes` from `../core/redact`; `ObservabilityRecord`/`Attributes` from `../core/types`.
- Produces:
  - `export const MAX_BATCH = 50` and `export const MAX_BYTES = 64 * 1024`.
  - `export type IngestResult = { ok: true; records: ObservabilityRecord[] } | { ok: false; reason: "too_large" | "too_many" | "invalid" }`.
  - `export function validateBatch(raw: unknown, byteLength: number): IngestResult` — enforces byte cap, count cap, Zod-parses a record-lite array, and re-redacts each record's `attributes` server-side.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/ingest/validate.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";

  import { validateBatch, MAX_BATCH, MAX_BYTES } from "./validate";

  const ctx = {
    env: "test" as const,
    runtime: "client" as const,
    release: null,
    requestId: null,
    sessionId: "s-1",
    route: "/x",
    actorHash: null,
    actorRole: null,
  };

  function logRec(attributes: Record<string, string | number | boolean | null>) {
    return {
      kind: "log",
      level: "info",
      message: "hi",
      attributes,
      context: ctx,
      timestamp: 1,
    };
  }

  describe("validateBatch", () => {
    it("accepts a well-formed batch and re-redacts attributes server-side", () => {
      const res = validateBatch([logRec({ ok: 1, token: "leak" })], 100);
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("unreachable");
      expect(res.records).toHaveLength(1);
      const rec = res.records[0]!;
      expect(rec.attributes).toEqual({ ok: 1 });
      expect("token" in rec.attributes).toBe(false);
    });

    it("rejects an oversized payload by byte length", () => {
      const res = validateBatch([logRec({})], MAX_BYTES + 1);
      expect(res).toEqual({ ok: false, reason: "too_large" });
    });

    it("rejects a batch with too many records", () => {
      const batch = Array.from({ length: MAX_BATCH + 1 }, () => logRec({}));
      const res = validateBatch(batch, 200);
      expect(res).toEqual({ ok: false, reason: "too_many" });
    });

    it("rejects a non-array payload", () => {
      const res = validateBatch({ nope: true }, 50);
      expect(res).toEqual({ ok: false, reason: "invalid" });
    });

    it("rejects a record with an unknown kind", () => {
      const res = validateBatch([{ ...logRec({}), kind: "bogus" }], 80);
      expect(res).toEqual({ ok: false, reason: "invalid" });
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/observability/ingest/validate.test.ts` — fails: `Failed to resolve import "./validate"`.

- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/ingest/validate.ts`:
  ```ts
  // Валидация и серверная ре-редакция входящего батча телеметрии.
  // Изоморфно: Zod-схема record-lite + cap'ы по размеру/количеству. Клиенту
  // не доверяем — атрибуты ещё раз прогоняем через redactAttributes.
  import { z } from "zod";

  import { redactAttributes } from "../core/redact";
  import type { Attributes, ObservabilityRecord } from "../core/types";

  export const MAX_BATCH = 50;
  export const MAX_BYTES = 64 * 1024;

  export type IngestResult =
    | { ok: true; records: ObservabilityRecord[] }
    | { ok: false; reason: "too_large" | "too_many" | "invalid" };

  const attrValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
  const attributes = z.record(z.string(), attrValue);

  const context = z.object({
    env: z.enum(["development", "production", "test"]),
    runtime: z.enum(["server", "client", "sw"]),
    release: z.string().nullable(),
    requestId: z.string().nullable(),
    sessionId: z.string().nullable(),
    route: z.string().nullable(),
    actorHash: z.string().nullable(),
    actorRole: z.string().nullable(),
  });

  const logRecord = z.object({
    kind: z.literal("log"),
    level: z.enum(["debug", "info", "warn", "error"]),
    message: z.string(),
    attributes,
    context,
    timestamp: z.number(),
  });

  const errorRecord = z.object({
    kind: z.literal("error"),
    errorClass: z.string(),
    message: z.string(),
    backendCode: z.string().nullable(),
    fingerprint: z.string().nullable(),
    handled: z.boolean(),
    cause: z
      .object({
        name: z.string(),
        message: z.string(),
        stack: z.string().nullable(),
      })
      .nullable(),
    attributes,
    context,
    timestamp: z.number(),
  });

  const metricRecord = z.object({
    kind: z.literal("metric"),
    metric: z.string(),
    metricKind: z.enum(["counter", "histogram"]),
    value: z.number(),
    unit: z.enum(["ms", "count"]).nullable(),
    attributes,
    context,
    timestamp: z.number(),
  });

  const record = z.discriminatedUnion("kind", [
    logRecord,
    errorRecord,
    metricRecord,
  ]);

  export function validateBatch(raw: unknown, byteLength: number): IngestResult {
    if (byteLength > MAX_BYTES) return { ok: false, reason: "too_large" };
    if (!Array.isArray(raw)) return { ok: false, reason: "invalid" };
    if (raw.length > MAX_BATCH) return { ok: false, reason: "too_many" };

    const parsed = z.array(record).safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const records = parsed.data.map((r) => ({
      ...r,
      attributes: redactAttributes(r.attributes as Attributes),
    })) as ObservabilityRecord[];
    return { ok: true, records };
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/services/observability/ingest/validate.test.ts` — 5 passing.

- [ ] **Step 5: Commit.** `git add src/services/observability/ingest/validate.ts src/services/observability/ingest/validate.test.ts && git commit -m "feat(observability): add telemetry batch validation + server re-redaction

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.7: Per-session in-memory rate limiter

**Files:**
- Create `src/services/observability/ingest/rate-limit.ts`
- Create `src/services/observability/ingest/rate-limit.test.ts`

**Interfaces:**
- Produces: `export function createTokenBucket(opts: { capacity: number; refillPerSec: number; now?: () => number }): { allow(key: string): boolean }` — per-key (sessionId) token bucket; single-node in-memory. Default `now` is `Date.now`; injectable for deterministic tests.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/ingest/rate-limit.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";

  import { createTokenBucket } from "./rate-limit";

  describe("createTokenBucket", () => {
    it("allows up to capacity then blocks the same key", () => {
      const now = () => 0;
      const bucket = createTokenBucket({ capacity: 2, refillPerSec: 1, now });
      expect(bucket.allow("s1")).toBe(true);
      expect(bucket.allow("s1")).toBe(true);
      expect(bucket.allow("s1")).toBe(false);
    });

    it("isolates buckets per key", () => {
      const now = () => 0;
      const bucket = createTokenBucket({ capacity: 1, refillPerSec: 1, now });
      expect(bucket.allow("s1")).toBe(true);
      expect(bucket.allow("s1")).toBe(false);
      expect(bucket.allow("s2")).toBe(true);
    });

    it("refills tokens over elapsed time", () => {
      let t = 0;
      const bucket = createTokenBucket({
        capacity: 1,
        refillPerSec: 1,
        now: () => t,
      });
      expect(bucket.allow("s1")).toBe(true);
      expect(bucket.allow("s1")).toBe(false);
      t = 1000; // +1s → +1 token
      expect(bucket.allow("s1")).toBe(true);
    });

    it("never exceeds capacity on refill", () => {
      let t = 0;
      const bucket = createTokenBucket({
        capacity: 2,
        refillPerSec: 5,
        now: () => t,
      });
      expect(bucket.allow("s1")).toBe(true);
      t = 10_000; // huge elapsed → cap at 2, not more
      expect(bucket.allow("s1")).toBe(true);
      expect(bucket.allow("s1")).toBe(true);
      expect(bucket.allow("s1")).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/observability/ingest/rate-limit.test.ts` — fails: `Failed to resolve import "./rate-limit"`.

- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/ingest/rate-limit.ts`:
  ```ts
  // Per-session token bucket для /api/telemetry. Single-node, in-memory —
  // достаточно для одного инстанса. Ключ — sessionId.
  interface BucketState {
    tokens: number;
    last: number;
  }

  export function createTokenBucket(opts: {
    capacity: number;
    refillPerSec: number;
    now?: () => number;
  }): { allow(key: string): boolean } {
    const now = opts.now ?? Date.now;
    const buckets = new Map<string, BucketState>();

    return {
      allow(key: string): boolean {
        const t = now();
        const state = buckets.get(key) ?? { tokens: opts.capacity, last: t };
        const elapsedSec = Math.max(0, (t - state.last) / 1000);
        const refilled = Math.min(
          opts.capacity,
          state.tokens + elapsedSec * opts.refillPerSec,
        );
        if (refilled < 1) {
          buckets.set(key, { tokens: refilled, last: t });
          return false;
        }
        buckets.set(key, { tokens: refilled - 1, last: t });
        return true;
      },
    };
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/services/observability/ingest/rate-limit.test.ts` — 4 passing.

- [ ] **Step 5: Commit.** `git add src/services/observability/ingest/rate-limit.ts src/services/observability/ingest/rate-limit.test.ts && git commit -m "feat(observability): add per-session in-memory token bucket for ingest

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.8: Ingest handler (pure, framework-free)

**Files:**
- Create `src/services/observability/ingest/handle-ingest.ts`
- Create `src/services/observability/ingest/handle-ingest.test.ts`

**Interfaces:**
- Consumes: `validateBatch`/`MAX_BYTES` from `./validate`; `createTokenBucket` from `./rate-limit`; `getSink` from `../core/registry`; `ObservabilityRecord` from `../core/types`.
- Produces: `export function createIngestHandler(deps?: { bucket?: { allow(key: string): boolean }; emit?: (r: ObservabilityRecord) => void }): (input: { sessionId: string | null; rawText: string }) => { status: 204 | 400 | 413 | 429; emitted: number }` — pure core: JSON-parse, rate-limit by sessionId, validate+re-redact, emit each record to the active sink. No `Request`/`Response` — Task 3.9 adapts it to Next.

- [ ] **Step 1: Write the FAILING test.** Create `src/services/observability/ingest/handle-ingest.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  import { createIngestHandler } from "./handle-ingest";
  import { MAX_BATCH } from "./validate";
  import type { ObservabilityRecord } from "../core/types";

  const ctx = {
    env: "test" as const,
    runtime: "client" as const,
    release: null,
    requestId: null,
    sessionId: "s-1",
    route: "/x",
    actorHash: null,
    actorRole: null,
  };

  function logText(attributes: Record<string, string | number | boolean | null>) {
    return JSON.stringify([
      {
        kind: "log",
        level: "info",
        message: "hi",
        attributes,
        context: ctx,
        timestamp: 1,
      },
    ]);
  }

  describe("createIngestHandler", () => {
    let emitted: ObservabilityRecord[];
    let emit: (r: ObservabilityRecord) => void;

    beforeEach(() => {
      emitted = [];
      emit = (r) => emitted.push(r);
    });

    it("emits validated, re-redacted records and returns 204", () => {
      const handle = createIngestHandler({
        bucket: { allow: () => true },
        emit,
      });
      const res = handle({ sessionId: "s-1", rawText: logText({ a: 1, token: "x" }) });
      expect(res).toEqual({ status: 204, emitted: 1 });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.attributes).toEqual({ a: 1 });
    });

    it("returns 400 on malformed JSON without emitting", () => {
      const handle = createIngestHandler({ bucket: { allow: () => true }, emit });
      const res = handle({ sessionId: "s-1", rawText: "{not json" });
      expect(res).toEqual({ status: 400, emitted: 0 });
      expect(emitted).toHaveLength(0);
    });

    it("returns 400 on an invalid (schema-violating) batch", () => {
      const handle = createIngestHandler({ bucket: { allow: () => true }, emit });
      const res = handle({ sessionId: "s-1", rawText: JSON.stringify({ nope: 1 }) });
      expect(res).toEqual({ status: 400, emitted: 0 });
    });

    it("returns 413 on too many records", () => {
      const handle = createIngestHandler({ bucket: { allow: () => true }, emit });
      const big = JSON.parse(logText({}));
      const batch = Array.from({ length: MAX_BATCH + 1 }, () => big[0]);
      const res = handle({ sessionId: "s-1", rawText: JSON.stringify(batch) });
      expect(res).toEqual({ status: 413, emitted: 0 });
    });

    it("returns 429 when the bucket denies the session", () => {
      const handle = createIngestHandler({ bucket: { allow: () => false }, emit });
      const res = handle({ sessionId: "s-1", rawText: logText({}) });
      expect(res).toEqual({ status: 429, emitted: 0 });
      expect(emitted).toHaveLength(0);
    });

    it("rate-limits under the anonymous bucket key when sessionId is null", () => {
      const seen: string[] = [];
      const handle = createIngestHandler({
        bucket: { allow: (k) => (seen.push(k), true) },
        emit,
      });
      handle({ sessionId: null, rawText: logText({}) });
      expect(seen).toEqual(["anon"]);
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/observability/ingest/handle-ingest.test.ts` — fails: `Failed to resolve import "./handle-ingest"`.

- [ ] **Step 3: Minimal implementation.** Create `src/services/observability/ingest/handle-ingest.ts`:
  ```ts
  // Чистое ядро ingest без Next/Request/Response — легко тестируется.
  // Порядок: JSON-parse → rate-limit(sessionId) → validate+re-redact → emit в sink.
  import { getSink } from "../core/registry";
  import type { ObservabilityRecord } from "../core/types";
  import { createTokenBucket } from "./rate-limit";
  import { validateBatch, MAX_BYTES } from "./validate";

  export interface IngestInput {
    sessionId: string | null;
    rawText: string;
  }
  export interface IngestOutput {
    status: 204 | 400 | 413 | 429;
    emitted: number;
  }

  const defaultBucket = createTokenBucket({ capacity: 20, refillPerSec: 1 });

  export function createIngestHandler(deps?: {
    bucket?: { allow(key: string): boolean };
    emit?: (r: ObservabilityRecord) => void;
  }): (input: IngestInput) => IngestOutput {
    const bucket = deps?.bucket ?? defaultBucket;
    const emit = deps?.emit ?? ((r: ObservabilityRecord) => getSink().emit(r));

    return ({ sessionId, rawText }) => {
      const key = sessionId ?? "anon";
      if (!bucket.allow(key)) return { status: 429, emitted: 0 };

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        return { status: 400, emitted: 0 };
      }

      const byteLength =
        typeof TextEncoder !== "undefined"
          ? new TextEncoder().encode(rawText).length
          : rawText.length;
      if (byteLength > MAX_BYTES) return { status: 413, emitted: 0 };

      const result = validateBatch(parsed, byteLength);
      if (!result.ok) {
        return { status: result.reason === "too_many" ? 413 : 400, emitted: 0 };
      }

      for (const rec of result.records) emit(rec);
      return { status: 204, emitted: result.records.length };
    };
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/services/observability/ingest/handle-ingest.test.ts` — 6 passing.

- [ ] **Step 5: Commit.** `git add src/services/observability/ingest/handle-ingest.ts src/services/observability/ingest/handle-ingest.test.ts && git commit -m "feat(observability): add framework-free telemetry ingest core handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.9: Next route /api/telemetry — POST adapter

**Files:**
- Create `src/app/api/telemetry/route.ts`
- Create `src/app/api/telemetry/route.test.ts`

**Interfaces:**
- Consumes: `createIngestHandler` from `@/services/observability/ingest/handle-ingest`; `initServerObservability` from `@/services/observability` (server barrel — ensures a sink is set even if `instrumentation.register()` did not run, e.g. under test).
- Produces: `export async function POST(req: Request): Promise<Response>` — reads `x-session-id` header + raw text body, runs the ingest core, maps `{status}` to a `new Response(null, { status })` (204 on success, 400/413/429 on rejection).

- [ ] **Step 1: Write the FAILING test.** Create `src/app/api/telemetry/route.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  const handle = vi.fn();
  const createIngestHandler = vi.fn(() => handle);
  const initServerObservability = vi.fn();

  vi.mock("@/services/observability/ingest/handle-ingest", () => ({
    createIngestHandler,
  }));
  vi.mock("@/services/observability", () => ({ initServerObservability }));

  import { POST } from "./route";

  function req(body: string, sessionId?: string) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (sessionId) headers["x-session-id"] = sessionId;
    return new Request("https://x.test/api/telemetry", {
      method: "POST",
      headers,
      body,
    });
  }

  beforeEach(() => {
    handle.mockReset();
    createIngestHandler.mockClear();
    initServerObservability.mockClear();
  });

  describe("POST /api/telemetry", () => {
    it("returns 204 with an empty body on a valid batch", async () => {
      handle.mockReturnValue({ status: 204, emitted: 2 });
      const res = await POST(req("[]", "s-1"));
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      expect(handle).toHaveBeenCalledWith({ sessionId: "s-1", rawText: "[]" });
    });

    it("passes a null sessionId when the header is missing", async () => {
      handle.mockReturnValue({ status: 204, emitted: 0 });
      await POST(req("[]"));
      expect(handle).toHaveBeenCalledWith({ sessionId: null, rawText: "[]" });
    });

    it("propagates a 413 for an oversized batch", async () => {
      handle.mockReturnValue({ status: 413, emitted: 0 });
      const res = await POST(req("[]", "s-1"));
      expect(res.status).toBe(413);
    });

    it("propagates a 429 when rate-limited", async () => {
      handle.mockReturnValue({ status: 429, emitted: 0 });
      const res = await POST(req("[]", "s-1"));
      expect(res.status).toBe(429);
    });

    it("ensures the server sink is initialized before handling", async () => {
      handle.mockReturnValue({ status: 204, emitted: 0 });
      await POST(req("[]", "s-1"));
      expect(initServerObservability).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/app/api/telemetry/route.test.ts` — fails: `Failed to resolve import "./route"`.

- [ ] **Step 3: Minimal implementation.** Create `src/app/api/telemetry/route.ts`:
  ```ts
  // src/app/api/telemetry/route.ts
  // Same-origin ingest клиентской телеметрии. Тонкий адаптер: достаём
  // x-session-id + сырое тело, прогоняем через чистое ядро ingest, маппим
  // статус в пустой Response. Вся логика и тесты — в @/services/observability.
  import { initServerObservability } from "@/services/observability";
  import { createIngestHandler } from "@/services/observability/ingest/handle-ingest";

  const handle = createIngestHandler();

  export async function POST(req: Request): Promise<Response> {
    initServerObservability();
    const sessionId = req.headers.get("x-session-id");
    const rawText = await req.text();
    const { status } = handle({ sessionId, rawText });
    return new Response(null, { status });
  }
  ```

- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/app/api/telemetry/route.test.ts` — 5 passing.

- [ ] **Step 5: Commit.** `git add src/app/api/telemetry/route.ts src/app/api/telemetry/route.test.ts && git commit -m "feat(observability): add POST /api/telemetry ingest route adapter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 3.10: Phase verification

**Files:** none (verification gate)

**Interfaces:** none.

- [ ] **Step 1: Run the full suite.** `pnpm test` — all Phase 3 specs pass alongside the existing suite; coverage stays at/above thresholds (statements 41 / branches 30 / functions 40 / lines 42).
- [ ] **Step 2: Lint.** `pnpm lint` — clean (no cross-feature/deep-import violations; `instrumentation-client.ts` + `register-client-error-handlers.ts` import only the client-safe barrel `@/services/observability/client`, never the server-only barrel).
- [ ] **Step 3: Build.** `pnpm build` — succeeds; Next picks up root `instrumentation-client.ts` and the `/api/telemetry` route.
- [ ] **Step 4: Confirm no edits to frozen zones.** `git diff --name-only main...HEAD` must NOT list `src/app/layout.tsx`, `src/components/ui/*`, or `vitest.config.ts`. The `<WebVitalsReporter/>` mount in `layout.tsx` is deferred to the separate foundation-update PR documented in Task 3.4.


---

## Phase 4: Offline/SW Metrics & Hygiene

Goal: surface offline-drain outcomes as observability metrics at the `use-offline-sync` composition root, replace the remaining ad-hoc `console.*` calls with the client `log` facade, and lock the boundary with a `no-console` ESLint rule. Depends on Phases 0-3 (facade, names, memory adapter, client barrel).

> **Boundary choice (load-bearing):** `drainOutbox` core in `src/services/offline/sync/drain.ts` stays PURE and entity-agnostic — it must not import observability (would couple the injectable core to a side-effecting seam and break its isomorphic testability). Aggregate metrics (`M.offlineDrain`, `M.offlineQueueDepth`) are derivable from the returned `DrainResult` + a pending-count read, so they are emitted at the `startOfflineSync` composition root. The one metric that needs **per-command** data — `M.offlineCommandPoison{entity}` (fired when a command's `attempts` crosses a poison threshold, i.e. head-of-line `deferred` or a `failed` with high attempts) — is plumbed through a new **optional** `onOutcome?` callback on `DrainDeps`, wired at the composition root, so core stays observability-free while still surfacing the per-command signal.

### Task 4.1: Add optional `onOutcome` callback to drain core (per-command poison hook)

**Files:**
- Modify `src/services/offline/sync/transport.ts` — add `DrainOutcome` type + `onOutcome?` to `DrainDeps` (after line 31).
- Modify `src/services/offline/sync/drain.ts` — invoke `deps.onOutcome` after each terminal command outcome (in the `done`/`deferred`/`failed` branches, lines 77-109).
- Modify `src/services/offline/sync/drain.test.ts` — new cases (colocated; create if absent — see Step 1).

**Interfaces:**
- Consumes: `OutboxCommand` from `../contract/storage`; `SyncSendResult` (existing).
- Produces:
  ```ts
  export type DrainOutcome =
    | { kind: "done"; command: OutboxCommand; serverId: string }
    | { kind: "deferred"; command: OutboxCommand; attempts: number; error: string }
    | { kind: "failed"; command: OutboxCommand; attempts: number; error: string };
  export interface DrainDeps {
    send: SyncTransport;
    onSynced?: ReconcileHook;
    onOutcome?: (outcome: DrainOutcome) => void; // sync, best-effort, never throws into core
  }
  ```

- [ ] **Step 1: Write the FAILING test.** Append to `src/services/offline/sync/drain.test.ts` (the file already mocks `../store/outbox` / `../store/db`; reuse its existing harness — open it first and add this `describe` block at the end, reusing the existing `seedPending` / mock helpers; if the file does not exist, create it with the self-contained harness below):
  ```ts
  describe("drainOutbox onOutcome callback", () => {
    it("вызывает onOutcome kind:done с serverId при успехе", async () => {
      seedPending([{ clientId: "c1", entity: "annotations", attempts: 0 }]);
      const onOutcome = vi.fn();
      const send = vi.fn(async () => ({ ok: true, serverId: "srv-1" }) as const);
      await drainOutbox({ send, onOutcome });
      expect(onOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "done", serverId: "srv-1" }),
      );
    });

    it("вызывает onOutcome kind:deferred с attempts при retriable-сбое", async () => {
      seedPending([{ clientId: "c1", entity: "annotations", attempts: 2 }]);
      const onOutcome = vi.fn();
      const send = vi.fn(
        async () => ({ ok: false, retriable: true, error: "offline" }) as const,
      );
      await drainOutbox({ send, onOutcome });
      expect(onOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "deferred", attempts: 3, error: "offline" }),
      );
    });

    it("вызывает onOutcome kind:failed при non-retriable-сбое", async () => {
      seedPending([{ clientId: "c1", entity: "annotations", attempts: 0 }]);
      const onOutcome = vi.fn();
      const send = vi.fn(
        async () => ({ ok: false, retriable: false, error: "422 invalid" }) as const,
      );
      await drainOutbox({ send, onOutcome });
      expect(onOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "failed", attempts: 1, error: "422 invalid" }),
      );
    });

    it("проглатывает исключение из onOutcome (best-effort, не рушит drain)", async () => {
      seedPending([{ clientId: "c1", entity: "annotations", attempts: 0 }]);
      const onOutcome = vi.fn(() => {
        throw new Error("boom");
      });
      const send = vi.fn(async () => ({ ok: true, serverId: "srv-1" }) as const);
      const result = await drainOutbox({ send, onOutcome });
      expect(result.done).toBe(1);
    });
  });
  ```
  If creating the file fresh, prepend:
  ```ts
  // src/services/offline/sync/drain.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  type Row = { clientId: string; entity: string; attempts: number; status: string; createdAt: string };
  const rows = new Map<string, Row>();
  const seedPending = (
    items: { clientId: string; entity: string; attempts: number }[],
  ): void => {
    rows.clear();
    for (const [i, it] of items.entries()) {
      rows.set(it.clientId, {
        ...it,
        status: "pending",
        createdAt: `2026-01-01T00:00:0${i}.000Z`,
      });
    }
  };
  vi.mock("../store/db", () => ({ openOfflineDb: vi.fn(() => Promise.reject(new Error("no-db-in-test"))) }));
  vi.mock("../store/outbox", () => ({
    listOutboxByStatus: vi.fn((status: string) =>
      Promise.resolve([...rows.values()].filter((r) => r.status === status)),
    ),
    updateOutboxCommand: vi.fn((clientId: string, patch: Partial<Row>) => {
      const cur = rows.get(clientId);
      if (cur) rows.set(clientId, { ...cur, ...patch });
      return Promise.resolve();
    }),
  }));
  // claimPending дергает openOfflineDb напрямую — замокаем сам drain-модуль частично:
  // переопределяем claimPending через spy на listOutboxByStatus путь невозможен,
  // поэтому мокаем claimPending локально.
  vi.mock("./drain", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./drain")>();
    return {
      ...actual,
      claimPending: vi.fn((clientId: string) => {
        const cur = rows.get(clientId);
        if (cur?.status !== "pending") return Promise.resolve(null);
        const claimed = { ...cur, status: "syncing" };
        rows.set(clientId, claimed);
        return Promise.resolve(claimed);
      }),
    };
  });

  import { drainOutbox } from "./drain";

  beforeEach(() => {
    rows.clear();
    vi.clearAllMocks();
  });
  ```
- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/offline/sync/drain.test.ts` — expect `TypeError`/assertion failure: `onOutcome` is never invoked (e.g. "Number of calls: 0" on the `expect(onOutcome).toHaveBeenCalledWith(...)`).
- [ ] **Step 3: Minimal implementation — transport.ts.** Insert the `DrainOutcome` type and extend `DrainDeps` in `src/services/offline/sync/transport.ts`, replacing the existing `DrainDeps` block (lines 28-31):
  ```ts
  /** Терминальный исход одной команды за проход (для per-command телеметрии). */
  export type DrainOutcome =
    | { kind: "done"; command: OutboxCommand; serverId: string }
    | { kind: "deferred"; command: OutboxCommand; attempts: number; error: string }
    | { kind: "failed"; command: OutboxCommand; attempts: number; error: string };

  export interface DrainDeps {
    send: SyncTransport;
    onSynced?: ReconcileHook;
    /**
     * Per-command хук исхода (best-effort, синхронный). Зовётся ПОСЛЕ записи
     * терминального статуса. Ядро не интерпретирует исход — точка съёма телеметрии
     * на composition root (поэтому drain.ts не импортирует observability).
     */
    onOutcome?: (outcome: DrainOutcome) => void;
  }
  ```
- [ ] **Step 4: Minimal implementation — drain.ts.** In `src/services/offline/sync/drain.ts`, add an `import type { DrainOutcome }` to the existing type import (line 10) and a local helper, then call it in each branch. Replace the type import line 10:
  ```ts
  import type {
    DrainDeps,
    DrainOutcome,
    DrainResult,
    SyncSendResult,
  } from "./transport";
  ```
  Add a helper right after `let draining = false;` (line 12):
  ```ts
  // best-effort: исход-хук никогда не валит проход (телеметрия — не критичный путь).
  function emitOutcome(deps: DrainDeps, outcome: DrainOutcome): void {
    if (!deps.onOutcome) return;
    try {
      deps.onOutcome(outcome);
    } catch {
      // swallow — onOutcome это съём метрик, не должен ломать дренаж
    }
  }
  ```
  In the `outcome.ok` branch, after `done++;` (line 89):
  ```ts
        emitOutcome(deps, { kind: "done", command: claimed, serverId: outcome.serverId });
  ```
  In the `outcome.retriable` branch, after `deferred++;` (line 96):
  ```ts
        emitOutcome(deps, {
          kind: "deferred",
          command: claimed,
          attempts: claimed.attempts + 1,
          error: outcome.error,
        });
  ```
  In the `else` (failed) branch, after `failed++;` (line 108):
  ```ts
        emitOutcome(deps, {
          kind: "failed",
          command: claimed,
          attempts: claimed.attempts + 1,
          error: outcome.error,
        });
  ```
- [ ] **Step 5: Run test, expect PASS.** `pnpm test src/services/offline/sync/drain.test.ts` — all four new cases green.
- [ ] **Step 6: Commit.** `git add src/services/offline/sync/transport.ts src/services/offline/sync/drain.ts src/services/offline/sync/drain.test.ts && git commit -m "feat(obs): add optional onOutcome hook to drain core for per-command telemetry

DrainDeps gains onOutcome?: keeps drain.ts core observability-free while
surfacing per-command done/deferred/failed for poison metrics at the root.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 4.2: Instrument `startOfflineSync` with drain metrics at the composition root

**Files:**
- Modify `src/app/_offline/use-offline-sync.ts` — change `run()` to consume `DrainResult`, read pending depth, emit metrics (lines 18-20, 6-9).
- Modify `src/app/_offline/use-offline-sync.test.ts` — drive with a fake transport returning ok/retriable/non-retriable, assert memory-sink metrics (full rewrite — see Step 1).

**Interfaces:**
- Consumes: `metrics`, `M` from `@/services/observability/client`; `setSink`, `getContext` are NOT touched here (test injects a memory sink). `drainOutbox`, `DrainResult`, `DrainOutcome` from offline sync; `listOutboxByStatus` from `@/services/offline/store/outbox` for queue depth.
- Produces: `startOfflineSync` unchanged signature `(send?: SyncTransport) => () => void`; emits per run: `metrics.histogram(M.offlineDrain, attempted)`, `metrics.increment(M.offlineDrain, { outcome }, n)` per outcome bucket, `metrics.histogram(M.offlineQueueDepth, pendingCount)`, and `metrics.increment(M.offlineCommandPoison, { entity })` per poison-threshold crossing.

**Decision — counter vs histogram for `M.offlineDrain`:** emit BOTH shapes (cheap, complementary): one `histogram(M.offlineDrain, attempted)` records the size of each drain pass (distribution of "work per drain"), and `increment(M.offlineDrain, { outcome: "done"|"deferred"|"failed" }, count)` gives summable per-outcome counters for alerting. `M.offlineQueueDepth` is a histogram of the pending backlog read AFTER the drain (gauge-as-histogram, the standard pattern for depth).

- [ ] **Step 1: Write the FAILING test (full rewrite of the file).** Replace the entire contents of `src/app/_offline/use-offline-sync.test.ts`:
  ```ts
  // src/app/_offline/use-offline-sync.test.ts
  import { describe, it, expect, beforeEach, vi } from "vitest";

  import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
  import { setSink } from "@/services/observability/core/registry";
  import { M } from "@/services/observability/core/names";
  import type { ObservabilityRecord, MetricRecord } from "@/services/observability/core/types";

  // drainOutbox мокаем: тест проверяет ИНСТРУМЕНТАЦИЮ root'а, а не ядро дренажа.
  const drainMock = vi.hoisted(() => vi.fn());
  vi.mock("@/services/offline/sync/drain", () => ({ drainOutbox: drainMock }));

  // queue-depth читается через listOutboxByStatus("pending").
  const listMock = vi.hoisted(() => vi.fn(() => Promise.resolve([])));
  vi.mock("@/services/offline/store/outbox", () => ({ listOutboxByStatus: listMock }));

  import { startOfflineSync } from "./use-offline-sync";

  let records: ObservabilityRecord[];
  const metricsOf = (name: string): MetricRecord[] =>
    records.filter((r): r is MetricRecord => r.kind === "metric" && r.metric === name);

  beforeEach(() => {
    const mem = createMemorySink();
    records = mem.records;
    setSink(mem.sink);
    drainMock.mockReset();
    listMock.mockReset();
    listMock.mockReturnValue(Promise.resolve([]));
    // По умолчанию: пустой проход + ничего в onOutcome.
    drainMock.mockResolvedValue({ skipped: false, attempted: 0, done: 0, failed: 0, deferred: 0 });
  });

  const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

  describe("startOfflineSync метрики", () => {
    it("эмитит histogram offlineDrain с числом attempted за проход", async () => {
      drainMock.mockResolvedValue({ skipped: false, attempted: 3, done: 2, failed: 0, deferred: 1 });
      const stop = startOfflineSync(vi.fn());
      await flush();
      const drain = metricsOf(M.offlineDrain).find((m) => m.metricKind === "histogram");
      expect(drain?.value).toBe(3);
      stop();
    });

    it("инкрементит offlineDrain по бакетам done/deferred/failed", async () => {
      drainMock.mockResolvedValue({ skipped: false, attempted: 4, done: 2, failed: 1, deferred: 1 });
      const stop = startOfflineSync(vi.fn());
      await flush();
      const counters = metricsOf(M.offlineDrain).filter((m) => m.metricKind === "counter");
      const byOutcome = (o: string): number =>
        counters.find((m) => m.attributes.outcome === o)?.value ?? 0;
      expect(byOutcome("done")).toBe(2);
      expect(byOutcome("failed")).toBe(1);
      expect(byOutcome("deferred")).toBe(1);
      stop();
    });

    it("эмитит histogram offlineQueueDepth с числом pending после дренажа", async () => {
      listMock.mockReturnValue(Promise.resolve([{ clientId: "a" }, { clientId: "b" }]));
      const stop = startOfflineSync(vi.fn());
      await flush();
      const depth = metricsOf(M.offlineQueueDepth).find((m) => m.metricKind === "histogram");
      expect(depth?.value).toBe(2);
      stop();
    });

    it("инкрементит offlineCommandPoison{entity} при пересечении порога attempts", async () => {
      drainMock.mockImplementation(
        (deps: { onOutcome?: (o: unknown) => void }): Promise<unknown> => {
          deps.onOutcome?.({
            kind: "deferred",
            command: { clientId: "c1", entity: "annotations", attempts: 5 },
            attempts: 5,
            error: "offline",
          });
          return Promise.resolve({ skipped: false, attempted: 1, done: 0, failed: 0, deferred: 1 });
        },
      );
      const stop = startOfflineSync(vi.fn());
      await flush();
      const poison = metricsOf(M.offlineCommandPoison);
      expect(poison).toHaveLength(1);
      expect(poison[0]?.attributes.entity).toBe("annotations");
      stop();
    });

    it("НЕ эмитит offlineCommandPoison при attempts ниже порога", async () => {
      drainMock.mockImplementation(
        (deps: { onOutcome?: (o: unknown) => void }): Promise<unknown> => {
          deps.onOutcome?.({
            kind: "deferred",
            command: { clientId: "c1", entity: "annotations", attempts: 1 },
            attempts: 1,
            error: "offline",
          });
          return Promise.resolve({ skipped: false, attempted: 1, done: 0, failed: 0, deferred: 1 });
        },
      );
      const stop = startOfflineSync(vi.fn());
      await flush();
      expect(metricsOf(M.offlineCommandPoison)).toHaveLength(0);
      stop();
    });

    it("дренажит на событие online (регрессия)", async () => {
      const stop = startOfflineSync(vi.fn());
      await flush();
      drainMock.mockClear();
      window.dispatchEvent(new Event("online"));
      expect(drainMock).toHaveBeenCalledTimes(1);
      stop();
    });

    it("после cleanup больше не реагирует на события (регрессия)", async () => {
      const stop = startOfflineSync(vi.fn());
      stop();
      drainMock.mockClear();
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
      expect(drainMock).not.toHaveBeenCalled();
    });
  });
  ```
- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/app/_offline/use-offline-sync.test.ts` — expect failure: no metric records emitted (e.g. "expected undefined to be 3" on the `offlineDrain` histogram, since `run()` still calls `void drainOutbox({ send })` with no instrumentation).
- [ ] **Step 3: Minimal implementation.** Replace the body of `src/app/_offline/use-offline-sync.ts`:
  ```ts
  // src/app/_offline/use-offline-sync.ts
  "use client";

  import { useEffect } from "react";

  import { drainOutbox } from "@/services/offline/sync/drain";
  import type { DrainOutcome } from "@/services/offline/sync/transport";
  import type { SyncTransport } from "@/services/offline/sync/transport";
  import { listOutboxByStatus } from "@/services/offline/store/outbox";
  import { metrics, M } from "@/services/observability/client";

  import { offlineTransport } from "./transport";

  // Порог «ядовитой» команды: столько раз её отложили/завалили — она встала
  // головой очереди (head-of-line) и тянет дренаж вниз. Сигнал для алертинга.
  const POISON_ATTEMPTS = 4;

  // Per-command хук: пересечение порога attempts → инкремент poison{entity}.
  function onDrainOutcome(outcome: DrainOutcome): void {
    if (outcome.kind === "done") return;
    if (outcome.attempts >= POISON_ATTEMPTS) {
      metrics.increment(M.offlineCommandPoison, { entity: outcome.command.entity });
    }
  }

  async function drainAndReport(send: SyncTransport): Promise<void> {
    const result = await drainOutbox({ send, onOutcome: onDrainOutcome });
    if (result.skipped) return; // дренаж уже шёл — чужой проход отметит метрики
    metrics.histogram(M.offlineDrain, result.attempted);
    metrics.increment(M.offlineDrain, { outcome: "done" }, result.done);
    metrics.increment(M.offlineDrain, { outcome: "failed" }, result.failed);
    metrics.increment(M.offlineDrain, { outcome: "deferred" }, result.deferred);
    const pending = await listOutboxByStatus("pending");
    metrics.histogram(M.offlineQueueDepth, pending.length);
  }

  /**
   * Вешает foreground-дренаж outbox на online/visibilitychange, дренажит при
   * старте и возвращает cleanup. Pure (без React) — тестируется в jsdom.
   * Каждый проход снимает метрики offlineDrain/offlineQueueDepth (root-инструментация,
   * ядро drain.ts остаётся observability-free).
   */
  export function startOfflineSync(
    send: SyncTransport = offlineTransport,
  ): () => void {
    const run = (): void => {
      void drainAndReport(send);
    };
    const onVisible = (): void => {
      if (document.visibilityState === "visible") run();
    };
    run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  /** Хук-обёртка: подключает синк на время жизни смонтировавшего компонента. */
  export function useOfflineSync(): void {
    useEffect(() => startOfflineSync(), []);
  }
  ```
- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/app/_offline/use-offline-sync.test.ts` — all seven cases green.
- [ ] **Step 5: Commit.** `git add src/app/_offline/use-offline-sync.ts src/app/_offline/use-offline-sync.test.ts && git commit -m "feat(obs): instrument startOfflineSync with drain + queue-depth metrics

Root consumes DrainResult → offlineDrain histogram + per-outcome counters,
offlineQueueDepth histogram, onOutcome → offlineCommandPoison{entity} past
attempts threshold. Core drain.ts stays observability-free.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 4.3: Replace ad-hoc `console.*` with the client `log` facade (file-by-file)

**Files:**
- Modify `src/hooks/use-register-sw.ts:53` — `console.error` → `log.error`.
- Modify `src/features/preferences/ui/push-subscription-toggle.tsx:112` — `console.error` → `log.error`.
- Modify `src/components/ast-editor/extensions/image-paste-drop-plugin.ts:61` (and the line-12 doc comment) — `console.warn` → `log.warn`.
- Modify `src/components/ast-render/block-renderer.tsx:56` — `console.warn` → `log.warn`.
- Modify `src/components/ast-render/inline-renderer.tsx:76` — `console.warn` → `log.warn`.
- Modify `src/components/ast-editor/drift-warn.ts:46` — `console.warn` → `log.warn`.
- Modify `src/components/ast-render/block-renderer.test.tsx` / `inline-renderer.test.tsx` — assert `log.warn` is called instead of `console.warn` if such an assertion exists (see Step 1); add a focused test for one swap.

**Interfaces:**
- Consumes: `log` from `@/services/observability/client` (client-safe barrel; all six call sites are client/isomorphic, never server-only). `Attributes` shape: structured payloads pass as the 2nd arg object (string/number/boolean/null values only — wrap arrays/objects as `count` numbers or JSON strings).
- Produces: no exported API change; runtime behavior swaps console for the facade (which redacts + routes to the active sink).

- [ ] **Step 1: Write the FAILING test.** Add a colocated test asserting the renderer logs via the facade. Append to `src/components/ast-render/block-renderer.test.tsx` (open it first; if it has no facade mock, add this `describe` and the mock at top-of-file alongside existing imports):
  ```ts
  vi.mock("@/services/observability/client", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));
  ```
  ```ts
  describe("BlockRenderer наблюдаемость", () => {
    it("логирует неизвестный тип блока через log.warn, а не console", async () => {
      const { log } = await import("@/services/observability/client");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // @ts-expect-error — намеренно невалидный тип блока для ветки default
      render(<BlockRenderer block={{ type: "__unknown__" }} ctx={{}} />);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("unsupported block type"),
        expect.objectContaining({ blockType: "__unknown__" }),
      );
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
  ```
  (Ensure the file's header has `import { render, screen, cleanup } from "@testing-library/react";` and a manual `afterEach(cleanup)`; adjust the `render(...)` props to match the renderer's actual signature shown in the existing tests.)
- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/components/ast-render/block-renderer.test.tsx` — expect failure: `log.warn` "Number of calls: 0" (code still calls `console.warn`).
- [ ] **Step 3: Minimal implementation — swap all six call sites.**
  `src/hooks/use-register-sw.ts` — add import after line 3 (`import { log } from "@/services/observability/client";`) and replace line 53:
  ```ts
        .catch((err: unknown) => {
          log.error("[SW] registration failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
  ```
  `src/features/preferences/ui/push-subscription-toggle.tsx` — add import (`import { log } from "@/services/observability/client";` in the `@/`-group) and replace line 112:
  ```ts
            log.error("[push] server unsubscribe failed", { error: result.error });
  ```
  `src/components/ast-editor/extensions/image-paste-drop-plugin.ts` — add `import { log } from "@/services/observability/client";` after line 4; update the doc comment on line 12 from `console.warn` to `log.warn`; replace line 61:
  ```ts
      log.warn("[ast-editor] image upload failed", { error: res.error });
  ```
  `src/components/ast-render/block-renderer.tsx` — add `import { log } from "@/services/observability/client";` after the existing imports; replace line 56:
  ```ts
          log.warn(`AstRender: unsupported block type "${String(_exhaustive)}"`, {
            blockType: String(_exhaustive),
          });
  ```
  `src/components/ast-render/inline-renderer.tsx` — add `import { log } from "@/services/observability/client";` after the existing imports; replace line 76:
  ```ts
          log.warn(`AstRender: unsupported mark type "${String(_exhaustive)}"`, {
            markType: String(_exhaustive),
          });
  ```
  `src/components/ast-editor/drift-warn.ts` — add `import { log } from "@/services/observability/client";` after line 2; replace the `console.warn(...)` block at line 46 (Attributes can't hold arrays — pass counts):
  ```ts
        log.warn(
          "[ast-editor] schema drift detected — regenerate src/api/schema.ts and update extensions",
          {
            newNodes: newNodes.join(",") || null,
            droppedNodes: droppedNodes.join(",") || null,
            newMarks: newMarks.join(",") || null,
            droppedMarks: droppedMarks.join(",") || null,
          },
        );
  ```
- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/components/ast-render/block-renderer.test.tsx` — green. Also run `pnpm test src/components/ast-render/inline-renderer.test.tsx` to confirm no regression.
- [ ] **Step 5: Commit.** `git add src/hooks/use-register-sw.ts src/features/preferences/ui/push-subscription-toggle.tsx src/components/ast-editor/extensions/image-paste-drop-plugin.ts src/components/ast-render/block-renderer.tsx src/components/ast-render/inline-renderer.tsx src/components/ast-editor/drift-warn.ts src/components/ast-render/block-renderer.test.tsx && git commit -m "refactor(obs): route ad-hoc console.* through client log facade

Six call sites (SW reg, push toggle, image-paste, ast-render block/inline,
drift-warn) now use log.* — structured attrs, redaction, sink routing.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 4.4: Add `no-console` ESLint guard (FOUNDATION — frozen eslint.config.mjs)

**Files:**
- Modify `eslint.config.mjs` — add a src-scoped `"no-console": "error"` block + a narrow override allowing console in the console-adapter and `scripts/` (after the strict-relaxations block, around lines 41-60).

> **FROZEN-FILE NOTE:** `eslint.config.mjs` is in CLAUDE.md's запретные зоны — this change ships as part of the observability **foundation PR**, not inside any feature slice. It is the enforcement lock for Tasks 4.3 and the rest of the observability initiative.

**Interfaces:**
- Consumes: existing flat-config blocks (no new plugins — `no-console` is a core ESLint rule).
- Produces: lint error on any `console.*` in `src/**` except `src/services/observability/adapters/console-adapter.ts` and `scripts/**`.

- [ ] **Step 1: Verify the guard would catch a violation (negative probe — no test file, this is a config change).** Temporarily confirm the current state is clean of stray console: `grep -rn "console\." "src" --include="*.ts" --include="*.tsx" | grep -v test | grep -v "console-adapter"` — expect EMPTY output (Task 4.3 already cleared the six; if non-empty, fix before adding the rule).
- [ ] **Step 2: Run lint, expect PASS pre-change (baseline).** `pnpm lint` — expect exit 0 (no `no-console` rule yet; establishes the baseline so the new rule's effect is isolated).
- [ ] **Step 3: Minimal implementation.** In `eslint.config.mjs`, add a new block immediately after the strict-relaxations block (after the closing `},` of the block ending at line 60, before the React-stack block at line 64):
  ```ts
    // no-console: единственный санкционированный канал логов — observability-фасад
    // (@/services/observability). console.* в src запрещён, чтобы логи проходили
    // через redaction + sink-роутинг, а не текли в stdout мимо наблюдаемости.
    {
      files: ["src/**/*.{ts,tsx}"],
      rules: {
        "no-console": "error",
      },
    },
    // Исключения: console-adapter — ЕДИНСТВЕННАЯ санкционированная точка вывода
    // (dev pretty-print / prod stdout JSON), и скрипты сборки/обслуживания.
    {
      files: [
        "src/services/observability/adapters/console-adapter.ts",
        "scripts/**/*.{ts,tsx,js,mjs,cjs}",
      ],
      rules: {
        "no-console": "off",
      },
    },
  ```
- [ ] **Step 4: Run lint, expect PASS.** `pnpm lint` — expect exit 0. The six swaps from Task 4.3 mean no `console.*` remains in `src/**` outside the allowlist; the new rule passes cleanly. (If it fails, a stray `console.*` slipped through — fix the call site, do NOT widen the allowlist.)
- [ ] **Step 5: Commit.** `git add eslint.config.mjs && git commit -m "feat(obs): enforce no-console in src via ESLint (foundation)

console.* banned in src/** except console-adapter.ts and scripts/. Locks the
log-facade-only invariant after the Task 4.3 swaps.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 4.5: Document/defer SW-lifecycle telemetry (minimal, decision-recorded)

**Files:**
- Modify `src/services/observability/index.ts` — add a documented `// TODO(obs/sw):` rationale comment near `initServerObservability` referencing the deferral (no runtime change).
- Create `src/services/observability/context/sw.test.ts` — a marker test asserting the SW-telemetry surface is intentionally absent (guards against silent half-wiring), OR is present if implemented.

**Interfaces:**
- Consumes: `Runtime` from `./core/types` (the `"sw"` variant already exists in the locked contract).
- Produces: a recorded DECISION — SW install/activate/fetch-fail telemetry is **DEFERRED**. Rationale: the SW (`public/sw.js` / `src/sw.template.js`) is a separate worker bundle with no access to the client `beacon` sink singleton; wiring `runtime:"sw"` telemetry requires a `postMessage` bridge (SW → page → `log` facade) whose surface is out of scope for this offline-metrics phase. The `Runtime="sw"` contract value is reserved for that future bridge.

- [ ] **Step 1: Write the FAILING test (marker for the deferral).** Create `src/services/observability/context/sw.test.ts`:
  ```ts
  // src/services/observability/context/sw.test.ts
  import { describe, it, expect } from "vitest";

  import type { Runtime } from "../core/types";

  describe("SW-телеметрия (отложено)", () => {
    it("контракт Runtime резервирует значение 'sw' для будущего postMessage-моста", () => {
      const sw: Runtime = "sw";
      expect(sw).toBe("sw");
    });

    it("SW-context модуль ещё не реализован (осознанный defer, не забытый half-wire)", async () => {
      // Если sw-context появится — этот тест надо обновить вместе с реализацией моста.
      await expect(import("./sw")).rejects.toThrow();
    });
  });
  ```
- [ ] **Step 2: Run it, expect FAIL.** `pnpm test src/services/observability/context/sw.test.ts` — expect failure on the first run only if a `./sw` module already exists; otherwise the `rejects.toThrow()` assertion may already pass while the FIRST assertion needs the `Runtime` import to compile. Run and confirm: expect the suite to FAIL initially because the test file is new and `Runtime` import resolution / the `rejects` expectation must be observed green together. If both pass immediately (no `./sw` module), this marker is already satisfied — proceed to Step 4 noting "no-op implementation".
- [ ] **Step 3: Minimal implementation (documentation only).** In `src/services/observability/index.ts`, add a comment block directly above the `initServerObservability` export:
  ```ts
  // TODO(obs/sw): SW-lifecycle телеметрия (install/activate/fetch-fail, runtime:"sw")
  // ОТЛОЖЕНА. SW — отдельный воркер-бандл без доступа к client-beacon singleton;
  // нужен postMessage-мост SW→page→facade. Значение Runtime="sw" зарезервировано
  // под него. См. Phase 4 plan, Task 4.5.
  ```
- [ ] **Step 4: Run test, expect PASS.** `pnpm test src/services/observability/context/sw.test.ts` — green (the `Runtime="sw"` assertion holds; `./sw` import rejects because the module is intentionally absent).
- [ ] **Step 5: Commit.** `git add src/services/observability/context/sw.test.ts src/services/observability/index.ts && git commit -m "docs(obs): record SW-lifecycle telemetry deferral with marker test

Runtime='sw' reserved for a future postMessage bridge (SW→page→facade); marker
test guards against silent half-wiring. No runtime change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 4.6: Phase verification — full lint + test + build green

**Files:** none (verification gate only).

**Interfaces:** Consumes the whole repo state after Tasks 4.1-4.5; produces a green CI triad as the phase exit criterion.

- [ ] **Step 1: Run the full test suite.** `pnpm test` — expect all suites green, including the rewritten `use-offline-sync.test.ts`, `drain.test.ts`, `block-renderer.test.tsx`, and `sw.test.ts`. Coverage must stay above thresholds (statements 41 / branches 30 / functions 40 / lines 42).
- [ ] **Step 2: Run lint.** `pnpm lint` — expect exit 0; specifically confirm `no-console` fires nowhere in `src/**` outside the allowlist.
- [ ] **Step 3: Run build.** `pnpm build` — expect a clean production build (verifies the client barrel `@/services/observability/client` is genuinely client-safe and the six swapped call sites don't pull `server-only` into client bundles: "server-only cannot be imported from a Client Component" would fail here if a wrong barrel was used).
- [ ] **Step 4: Record the gate result.** If all three pass, Phase 4 is complete. No commit (verification only). If any step fails, fix the offending task's code/test before declaring the phase done — do NOT loosen coverage thresholds or the `no-console` allowlist to make it pass.


---
