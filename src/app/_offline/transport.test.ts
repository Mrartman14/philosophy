// src/app/_offline/transport.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";

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
