// src/app/_offline/offline-write.test.ts
import { describe, it, expect } from "vitest";

import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

import { runOfflineWrite } from "./offline-write";

type WriteFn = NonNullable<OfflineDescriptor["write"]>;

function makeResolver(write: WriteFn | null): DescriptorResolver {
  const descriptor: OfflineDescriptor = {
    entity: "annotations",
    pathSegment: "annotations",
    assemble: () => Promise.resolve(null),
    extractImageKeys: () => [],
    ...(write ? { write } : {}),
  };
  return (entity) => (entity === "annotations" ? descriptor : undefined);
}

const BODY = { clientId: "c1", op: "create", payload: { text: "x" } };

describe("runOfflineWrite", () => {
  it("успех write → 200 + {data:{id}}", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "srv-1" } }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 200,
      body: { data: { id: "srv-1" } },
    });
  });

  it("forbidden → 403", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: false, error: "Нет прав", code: "forbidden" }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 403,
      body: { error: "Нет прав" },
    });
  });

  it("validation → 422 + fieldErrors", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({
        success: false,
        error: "Ошибка валидации",
        code: "validation",
        fieldErrors: { text: "обязательно" },
      }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 422,
      body: { error: "Ошибка валидации", fieldErrors: { text: "обязательно" } },
    });
  });

  it("generic error → 500 (retriable)", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: false, error: "boom" }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 500,
      body: { error: "boom" },
    });
  });

  it("нет дескриптора → 404", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "x" } }),
    );
    expect(
      (await runOfflineWrite(resolve, "unknown", BODY)).status,
    ).toBe(404);
  });

  it("дескриптор без write → 404", async () => {
    expect(
      (await runOfflineWrite(makeResolver(null), "annotations", BODY)).status,
    ).toBe(404);
  });

  it("невалидное тело → 400", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "x" } }),
    );
    expect(
      (await runOfflineWrite(resolve, "annotations", { op: "create" })).status,
    ).toBe(400);
  });

  it("неизвестный op (не create) → 400", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "x" } }),
    );
    expect(
      (
        await runOfflineWrite(resolve, "annotations", {
          clientId: "c1",
          op: "delete",
          payload: {},
        })
      ).status,
    ).toBe(400);
  });
});
