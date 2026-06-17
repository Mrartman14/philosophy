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
    increment: (...a: unknown[]) => increment(...a) as unknown,
    histogram: (...a: unknown[]) => histogram(...a) as unknown,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    startTimer: () => () => {},
  },
  errors: { capture: (...a: unknown[]) => capture(...a) as unknown },
}));

import { M } from "./core/names";
import { instrumentedFetch } from "./server-fetch";

describe("instrumentedFetch", () => {
  beforeEach(() => {
    increment.mockClear();
    histogram.mockClear();
    capture.mockClear();
  });

  it("stamps X-Request-Id and records api.duration on success", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await instrumentedFetch("http://x/y", { method: "POST" }, { surface: "media.upload" });

    expect(res.status).toBe(204);
    const passedInit = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(passedInit?.headers);
    expect(headers.get("X-Request-Id")).toBe("req-7");
    expect(histogram).toHaveBeenCalledWith(
      M.apiRequestDuration,
      expect.any(Number),
      { transport: "fetch", surface: "media.upload", status: 204 },
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it("records api.error + captures network class on throw and rethrows", async () => {
    const boom = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(boom)));

    await expect(
      instrumentedFetch("http://x/y", undefined, { surface: "media.upload" }),
    ).rejects.toBe(boom);

    expect(increment).toHaveBeenCalledWith(
      M.apiRequestError,
      { transport: "fetch", surface: "media.upload", errorClass: "network" },
    );
    expect(capture).toHaveBeenCalledWith(boom, { errorClass: "network", handled: false });
  });

  it("defaults surface to 'fetch' when meta is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))));
    await instrumentedFetch("http://x/y");
    expect(histogram).toHaveBeenCalledWith(
      M.apiRequestDuration,
      expect.any(Number),
      { transport: "fetch", surface: "fetch", status: 200 },
    );
  });

  it("сохраняет переданные вызывающим заголовки и добавляет X-Request-Id", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await instrumentedFetch("https://api.test/x", { headers: { Authorization: "Bearer tok" } }, { surface: "me" });

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(headers.get("X-Request-Id")).toBe("req-7");
  });
});
