// src/app/_offline/offline-read.test.ts
import { describe, it, expect } from "vitest";

import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

import { assembleBundle } from "./offline-read";

const SNAPSHOT = { title: "L1", imageKeys: ["sha-a", "sha-b"] };

const descriptor: OfflineDescriptor = {
  entity: "lectures",
  pathSegment: "lectures",
  assemble: (id) => Promise.resolve(id === "l1" ? SNAPSHOT : null),
  extractImageKeys: (snapshot) =>
    (snapshot as { imageKeys: string[] }).imageKeys,
};

const resolve: DescriptorResolver = (entity) =>
  entity === "lectures" ? descriptor : undefined;

describe("assembleBundle", () => {
  it("собирает {snapshot, imageKeys} для существующей сущности", async () => {
    expect(await assembleBundle(resolve, "lectures", "l1")).toEqual({
      snapshot: SNAPSHOT,
      imageKeys: ["sha-a", "sha-b"],
    });
  });

  it("null, если assemble вернул null", async () => {
    expect(await assembleBundle(resolve, "lectures", "missing")).toBeNull();
  });

  it("null, если нет дескриптора сущности", async () => {
    expect(await assembleBundle(resolve, "unknown", "l1")).toBeNull();
  });
});
