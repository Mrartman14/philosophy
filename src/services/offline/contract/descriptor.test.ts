// src/services/offline/contract/descriptor.test.ts
import { describe, it, expect } from "vitest";

import type { OfflineDescriptor } from "./descriptor";

interface DemoSnapshot {
  id: string;
  imageKeys: string[];
}
interface DemoPayload {
  text: string;
}

// Конформный дескриптор: компилируется ⇒ форма контракта верна.
const demo: OfflineDescriptor<DemoSnapshot, DemoPayload> = {
  entity: "demo",
  pathSegment: "demos",
  assemble: (id) => Promise.resolve({ id, imageKeys: ["sha-1"] }),
  extractImageKeys: (snap) => snap.imageKeys,
  write: (payload, key) =>
    Promise.resolve({ success: true, data: { id: `${key}:${payload.text}` } }),
};

describe("OfflineDescriptor contract", () => {
  it("assemble возвращает типизированный снимок", async () => {
    const snap = await demo.assemble("d1");
    expect(snap).toEqual({ id: "d1", imageKeys: ["sha-1"] });
  });

  it("extractImageKeys читает sha-ключи из снимка", () => {
    expect(demo.extractImageKeys({ id: "d1", imageKeys: ["a", "b"] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("write опционален и возвращает ActionResult<{id}>", async () => {
    expect(demo.write).toBeDefined();
    if (!demo.write) throw new Error("ожидали write у фикстуры");
    expect(await demo.write({ text: "x" }, "key-1")).toEqual({
      success: true,
      data: { id: "key-1:x" },
    });
  });
});
