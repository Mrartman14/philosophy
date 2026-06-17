// src/services/offline/sync/drain.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  enqueueOutbox,
  getOutboxCommand,
  updateOutboxCommand,
} from "../store/outbox";

import { claimPending, drainOutbox } from "./drain";
import type { DrainResult, SyncTransport } from "./transport";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("drainOutbox", () => {
  it("на 2xx помечает команду done + serverId", async () => {
    const cmd = await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: { text: "x" },
    });
    const send: SyncTransport = () =>
      Promise.resolve({ ok: true, serverId: "srv-1" });

    const result = await drainOutbox({ send });

    expect(result).toMatchObject({
      skipped: false,
      attempted: 1,
      done: 1,
      failed: 0,
      deferred: 0,
    });
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "done",
      serverId: "srv-1",
    });
  });

  it("обрабатывает команды oldest-first (по createdAt, НЕ по clientId)", async () => {
    // clientId намеренно в ОБРАТНОМ лексикографическом порядке к createdAt:
    // если убрать сортировку по createdAt, индекс отдаст по clientId (a-new < z-old)
    // и тест упадёт — значит он реально проверяет сортировку, а не порядок ключей.
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "z-old",
      createdAt: "2026-06-14T00:00:01.000Z",
    });
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "a-new",
      createdAt: "2026-06-14T00:00:02.000Z",
    });
    const seen: string[] = [];
    const send: SyncTransport = (command) => {
      seen.push(command.clientId);
      return Promise.resolve({ ok: true, serverId: `srv-${command.clientId}` });
    };

    await drainOutbox({ send });

    expect(seen).toEqual(["z-old", "a-new"]);
  });

  it("вызывает onSynced с (command, serverId) на успехе", async () => {
    const cmd = await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: {},
    });
    const calls: { clientId: string; serverId: string }[] = [];

    await drainOutbox({
      send: () => Promise.resolve({ ok: true, serverId: "srv-9" }),
      onSynced: (command, serverId) => {
        calls.push({ clientId: command.clientId, serverId });
        return Promise.resolve();
      },
    });

    expect(calls).toEqual([{ clientId: cmd.clientId, serverId: "srv-9" }]);
  });

  it("на не-retriable (4xx) помечает failed и продолжает к следующей", async () => {
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "bad",
      createdAt: "2026-06-14T00:00:01.000Z",
    });
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "good",
      createdAt: "2026-06-14T00:00:02.000Z",
    });
    const send: SyncTransport = (command) =>
      Promise.resolve(
        command.clientId === "bad"
          ? { ok: false, retriable: false, error: "forbidden" }
          : { ok: true, serverId: "srv" },
      );

    const result = await drainOutbox({ send });

    expect(result).toMatchObject({ attempted: 2, done: 1, failed: 1 });
    expect(await getOutboxCommand("bad")).toMatchObject({
      status: "failed",
      lastError: "forbidden",
      attempts: 1,
    });
    expect(await getOutboxCommand("good")).toMatchObject({ status: "done" });
  });

  it("на retriable оставляет pending, инкрементит attempts и стопит дренаж", async () => {
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "net",
      createdAt: "2026-06-14T00:00:01.000Z",
    });
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "later",
      createdAt: "2026-06-14T00:00:02.000Z",
    });
    const seen: string[] = [];
    const send: SyncTransport = (command) => {
      seen.push(command.clientId);
      return Promise.resolve({ ok: false, retriable: true, error: "offline" });
    };

    const result = await drainOutbox({ send });

    expect(seen).toEqual(["net"]); // остановились до "later"
    expect(result).toMatchObject({ attempted: 1, deferred: 1, done: 0 });
    expect(await getOutboxCommand("net")).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "offline",
    });
    expect(await getOutboxCommand("later")).toMatchObject({
      status: "pending",
      attempts: 0,
    });
  });

  it("брошенное транспортом исключение трактуется как transient", async () => {
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    const send: SyncTransport = () => Promise.reject(new Error("boom"));

    const result = await drainOutbox({ send });

    expect(result).toMatchObject({ attempted: 1, deferred: 1 });
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "boom",
    });
  });

  it("реклеймит осиротевшие syncing-команды и синкает их (recovery)", async () => {
    // Симулируем оборванный предыдущий drain: команда застряла в syncing.
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    await updateOutboxCommand(cmd.clientId, { status: "syncing" });
    let calls = 0;
    const send: SyncTransport = () => {
      calls++;
      return Promise.resolve({ ok: true, serverId: "srv" });
    };

    const result = await drainOutbox({ send });

    expect(calls).toBe(1);
    expect(result).toMatchObject({ skipped: false, attempted: 1, done: 1 });
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "done",
      serverId: "srv",
    });
  });

  it("single-drain: повторный вызов во время дренажа возвращает skipped", async () => {
    await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    let reentrant: DrainResult | undefined;
    const send: SyncTransport = async () => {
      reentrant = await drainOutbox({
        send: () => Promise.resolve({ ok: true, serverId: "inner" }),
      });
      return { ok: true, serverId: "outer" };
    };

    await drainOutbox({ send });

    expect(reentrant?.skipped).toBe(true);
    expect(reentrant?.attempted).toBe(0);
  });
});

describe("drainOutbox onOutcome callback", () => {
  it("вызывает onOutcome kind:done с serverId при успехе", async () => {
    const cmd = await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: { text: "x" },
    });
    const onOutcome = vi.fn();
    const send = vi.fn(() => Promise.resolve({ ok: true, serverId: "srv-1" }) as const);
    await drainOutbox({ send, onOutcome });
    expect(onOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "done", serverId: "srv-1" }),
    );
    expect(onOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.objectContaining({ clientId: cmd.clientId }) as object }),
    );
  });

  it("вызывает onOutcome kind:deferred с attempts при retriable-сбое", async () => {
    await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: {},
      clientId: "c1-deferred",
    });
    // Simulate 2 prior attempts
    await updateOutboxCommand("c1-deferred", { attempts: 2 });
    const onOutcome = vi.fn();
    const send = vi.fn(
      () => Promise.resolve({ ok: false, retriable: true, error: "offline" }) as const,
    );
    await drainOutbox({ send, onOutcome });
    expect(onOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "deferred", attempts: 3, error: "offline" }),
    );
  });

  it("вызывает onOutcome kind:failed при non-retriable-сбое", async () => {
    await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: {},
    });
    const onOutcome = vi.fn();
    const send = vi.fn(
      () => Promise.resolve({ ok: false, retriable: false, error: "422 invalid" }) as const,
    );
    await drainOutbox({ send, onOutcome });
    expect(onOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "failed", attempts: 1, error: "422 invalid" }),
    );
  });

  it("проглатывает исключение из onOutcome (best-effort, не рушит drain)", async () => {
    await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: {},
    });
    const onOutcome = vi.fn(() => {
      throw new Error("boom");
    });
    const send = vi.fn(() => Promise.resolve({ ok: true, serverId: "srv-1" }) as const);
    const result = await drainOutbox({ send, onOutcome });
    expect(result.done).toBe(1);
  });
});

describe("claimPending", () => {
  it("переводит pending→syncing и возвращает команду", async () => {
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    const claimed = await claimPending(cmd.clientId);
    expect(claimed?.status).toBe("syncing");
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "syncing",
    });
  });

  it("возвращает null для уже заклеймленной (не-pending) команды", async () => {
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    await claimPending(cmd.clientId);
    expect(await claimPending(cmd.clientId)).toBeNull();
  });

  it("возвращает null для несуществующей команды", async () => {
    expect(await claimPending("nope")).toBeNull();
  });
});
