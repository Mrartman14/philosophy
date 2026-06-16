// src/services/offline/store/outbox.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import type { OutboxEnqueueInput } from "../contract/storage";

import {
  enqueueOutbox,
  getOutboxCommand,
  listOutbox,
  listOutboxByStatus,
  listOutboxByEntity,
  updateOutboxCommand,
  deleteOutboxCommand,
} from "./outbox";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeInput(entity: string): OutboxEnqueueInput {
  return { entity, op: "create", payload: { foo: entity } };
}

describe("outbox store", () => {
  it("enqueue проставляет clientId, createdAt, status=pending, attempts=0", async () => {
    const cmd = await enqueueOutbox(makeInput("annotation"));
    expect(cmd.clientId).toMatch(/[0-9a-f-]{36}/);
    expect(cmd.status).toBe("pending");
    expect(cmd.attempts).toBe(0);
    expect(typeof cmd.createdAt).toBe("string");
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      clientId: cmd.clientId,
      status: "pending",
    });
  });

  it("enqueue уважает переданный clientId (идемпотентность)", async () => {
    const cmd = await enqueueOutbox({
      ...makeInput("annotation"),
      clientId: "fixed-id",
    });
    expect(cmd.clientId).toBe("fixed-id");
  });

  it("listOutbox возвращает все команды", async () => {
    await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("comment"));
    expect(await listOutbox()).toHaveLength(2);
  });

  it("listOutboxByStatus фильтрует по статусу", async () => {
    const a = await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("annotation"));
    await updateOutboxCommand(a.clientId, { status: "done" });
    expect(await listOutboxByStatus("pending")).toHaveLength(1);
    const done = await listOutboxByStatus("done");
    expect(done).toHaveLength(1);
    expect(done[0]?.clientId).toBe(a.clientId);
  });

  it("listOutboxByEntity фильтрует по сущности", async () => {
    await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("comment"));
    expect(await listOutboxByEntity("annotation")).toHaveLength(2);
    expect(await listOutboxByEntity("comment")).toHaveLength(1);
  });

  it("updateOutboxCommand мёржит patch (serverId, attempts, lastError)", async () => {
    const c = await enqueueOutbox(makeInput("annotation"));
    await updateOutboxCommand(c.clientId, {
      status: "failed",
      attempts: 2,
      lastError: "forbidden",
      serverId: "srv-1",
    });
    expect(await getOutboxCommand(c.clientId)).toMatchObject({
      status: "failed",
      attempts: 2,
      lastError: "forbidden",
      serverId: "srv-1",
    });
  });

  it("updateOutboxCommand сохраняет немодифицированные поля при патче", async () => {
    const c = await enqueueOutbox({
      ...makeInput("annotation"),
      clientId: "atomic-test-id",
    });
    await updateOutboxCommand(c.clientId, { status: "done" });
    const updated = await getOutboxCommand(c.clientId);
    expect(updated).toMatchObject({
      clientId: "atomic-test-id",
      entity: "annotation",
      op: "create",
      status: "done",
      attempts: 0,
    });
  });

  it("updateOutboxCommand без броска возвращает undefined для отсутствующей записи", async () => {
    await expect(
      updateOutboxCommand("non-existent-id", { status: "done" }),
    ).resolves.toBeUndefined();
    expect(await getOutboxCommand("non-existent-id")).toBeUndefined();
  });

  it("deleteOutboxCommand удаляет запись", async () => {
    const c = await enqueueOutbox(makeInput("annotation"));
    await deleteOutboxCommand(c.clientId);
    expect(await getOutboxCommand(c.clientId)).toBeUndefined();
  });
});
