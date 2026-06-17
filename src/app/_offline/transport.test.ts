// src/app/_offline/transport.test.ts
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

const { histogram, increment, capture } = vi.hoisted(() => ({
  histogram: vi.fn(),
  increment: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/services/observability/client", async () => {
  const { M } = await import("@/services/observability/core/names");
  return {
    metrics: {
      histogram,
      increment,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      startTimer: () => () => {},
    },
    errors: { capture },
    M,
  };
});

import { M } from "@/services/observability/core/names";
import type { OutboxCommand } from "@/services/offline/contract/storage";

import { offlineTransport } from "./transport";

function command(): OutboxCommand {
  return {
    clientId: "c1",
    entity: "annotations",
    op: "create",
    payload: { text: "x" },
    createdAt: "2026-06-14T00:00:00.000Z",
    status: "syncing",
    attempts: 0,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offlineTransport", () => {
  it("2xx + {data:{id}} → {ok:true, serverId}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: { id: "srv-1" } }), {
            status: 200,
          }),
        ),
      ),
    );
    expect(await offlineTransport(command())).toEqual({
      ok: true,
      serverId: "srv-1",
    });
  });

  it("2xx без id → не-retriable отказ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: {} }), { status: 200 }),
        ),
      ),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: false,
    });
  });

  it("4xx → retriable:false + текст ошибки из тела", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Нет прав" }), { status: 403 }),
        ),
      ),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: false,
      error: "Нет прав",
    });
  });

  it("5xx → retriable:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("boom", { status: 503 }))),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: true,
    });
  });

  it("2xx с не-JSON телом → не-retriable отказ (не вечный ретрай)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("<html>login</html>", { status: 200 })),
      ),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: false,
    });
  });

  it("шлёт POST на /api/offline/{entity} с телом команды и same-origin", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { id: "x" } }), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await offlineTransport(command());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/offline/annotations",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });
});

const obsCmd = {
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
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: { id: "s1" } }), { status: 200 }),
        ),
      ),
    );
    const res = await offlineTransport(obsCmd);
    expect(res).toEqual({ ok: true, serverId: "s1" });
    expect(histogram).toHaveBeenCalledWith(
      M.apiRequestDuration,
      expect.any(Number),
      { transport: "fetch", surface: "offline.transport", status: 200 },
    );
  });

  it("records api.error and rethrows on network throw", async () => {
    const boom = new TypeError("fetch failed");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(boom)),
    );
    await expect(offlineTransport(obsCmd)).rejects.toBe(boom);
    expect(increment).toHaveBeenCalledWith(
      M.apiRequestError,
      { transport: "fetch", surface: "offline.transport", errorClass: "network" },
    );
    expect(capture).toHaveBeenCalledWith(boom, { errorClass: "network", handled: false, attributes: { surface: "offline.transport" } });
  });
});
