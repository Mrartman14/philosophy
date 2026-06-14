// src/services/offline/store/outbox.ts
// Browser-only: generic персистентная очередь отложенных записей.
// ВНИМАНИЕ: атомарный claim "pending→syncing" (single-drain) НЕ здесь —
// его строит sync-слой напрямую через openOfflineDb() readwrite-транзакцией.
import { openOfflineDb } from "./db";
import {
  type OutboxCommand,
  type OutboxEnqueueInput,
  type OutboxPatch,
  type OutboxStatus,
} from "../contract/storage";

export async function enqueueOutbox(
  input: OutboxEnqueueInput,
): Promise<OutboxCommand> {
  const command: OutboxCommand = {
    clientId: input.clientId ?? crypto.randomUUID(),
    entity: input.entity,
    op: input.op,
    payload: input.payload,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  const db = await openOfflineDb();
  try {
    await db.put("outbox", command);
  } finally {
    db.close();
  }
  return command;
}

export async function getOutboxCommand(
  clientId: string,
): Promise<OutboxCommand | undefined> {
  const db = await openOfflineDb();
  try {
    return await db.get("outbox", clientId);
  } finally {
    db.close();
  }
}

export async function listOutbox(): Promise<OutboxCommand[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAll("outbox");
  } finally {
    db.close();
  }
}

export async function listOutboxByStatus(
  status: OutboxStatus,
): Promise<OutboxCommand[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("outbox", "by-status", status);
  } finally {
    db.close();
  }
}

export async function listOutboxByEntity(
  entity: string,
): Promise<OutboxCommand[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("outbox", "by-entity", entity);
  } finally {
    db.close();
  }
}

export async function updateOutboxCommand(
  clientId: string,
  patch: OutboxPatch,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    const existing = await db.get("outbox", clientId);
    if (existing) {
      await db.put("outbox", { ...existing, ...patch });
    }
  } finally {
    db.close();
  }
}

export async function deleteOutboxCommand(clientId: string): Promise<void> {
  const db = await openOfflineDb();
  try {
    await db.delete("outbox", clientId);
  } finally {
    db.close();
  }
}
