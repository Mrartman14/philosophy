import { beforeEach, describe, expect, it, vi } from "vitest";

import { M } from "@/services/observability/core/names";

import { createPublicApiClient } from "./client";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined }),
}));

vi.mock("@/services/observability/core/registry", async (orig) => {
  const actual = await orig<typeof import("@/services/observability/core/registry")>();
  return {
    ...actual,
    getContext: () => ({
      env: "test",
      runtime: "server",
      release: null,
      requestId: "req-mw",
      sessionId: null,
      route: null,
      actorHash: null,
      actorRole: null,
    }),
  };
});

const histogram = vi.fn();
const increment = vi.fn();
const capture = vi.fn();

vi.mock("@/services/observability", async () => {
  const { M } = await import("@/services/observability/core/names");
  return {
    metrics: {
      histogram: (...a: unknown[]) => histogram(...a) as unknown,
      increment: (...a: unknown[]) => increment(...a) as unknown,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      startTimer: () => () => {},
    },
    errors: { capture: (...a: unknown[]) => capture(...a) as unknown },
    log: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
    M,
  };
});

describe("api client observability middleware", () => {
  beforeEach(() => {
    histogram.mockClear();
    increment.mockClear();
    capture.mockClear();
  });

  it("stamps X-Request-Id and emits api.duration with templated route", async () => {
    let seenHeader: string | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((req: Request) => {
        seenHeader = req.headers.get("X-Request-Id");
        return Promise.resolve(
          new Response(JSON.stringify({ data: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    const api = createPublicApiClient();
    await api.GET("/api/annotations/{id}", { params: { path: { id: "a1" } } });

    expect(seenHeader).toBe("req-mw");
    expect(histogram).toHaveBeenCalledWith(M.apiRequestDuration, expect.any(Number), {
      transport: "openapi",
      method: "GET",
      route: "/api/annotations/{id}",
      status: 200,
    });
  });

  it("emits api.error + captures network on transport throw", async () => {
    const boom = new TypeError("fetch failed");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(boom)),
    );

    const api = createPublicApiClient();
    await api
      .GET("/api/annotations/{id}", { params: { path: { id: "a1" } } })
      .catch(() => undefined);

    expect(increment).toHaveBeenCalledWith(M.apiRequestError, {
      transport: "openapi",
      method: "GET",
      route: "/api/annotations/{id}",
      errorClass: "network",
    });
    expect(capture).toHaveBeenCalledWith(boom, { errorClass: "network", handled: false });
  });
});
