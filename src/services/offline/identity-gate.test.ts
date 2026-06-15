import { describe, it, expect, beforeEach } from "vitest";

import {
  closeIdentityGate,
  openIdentityGate,
  whenIdentityReconciled,
} from "./identity-gate";

// Барьер — модульный синглтон; приводим к открытому состоянию перед каждым тестом.
beforeEach(() => {
  openIdentityGate();
});

describe("identity-gate", () => {
  it("по умолчанию открыт → whenIdentityReconciled резолвится сразу", async () => {
    await expect(whenIdentityReconciled()).resolves.toBeUndefined();
  });

  it("closeIdentityGate держит барьер закрытым до openIdentityGate", async () => {
    closeIdentityGate();
    let resolved = false;
    void whenIdentityReconciled().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    openIdentityGate();
    await whenIdentityReconciled();
    expect(resolved).toBe(true);
  });

  it("closeIdentityGate идемпотентен: повтор не пересоздаёт барьер", async () => {
    closeIdentityGate();
    const first = whenIdentityReconciled();
    closeIdentityGate();
    expect(whenIdentityReconciled()).toBe(first);

    openIdentityGate();
    await expect(first).resolves.toBeUndefined();
  });

  it("openIdentityGate идемпотентен и резолвит ожидающих", async () => {
    closeIdentityGate();
    const pending = whenIdentityReconciled();
    openIdentityGate();
    openIdentityGate();
    await expect(pending).resolves.toBeUndefined();
  });
});
