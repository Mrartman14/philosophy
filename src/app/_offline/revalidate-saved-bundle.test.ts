import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";

const probeMock = vi.hoisted(() => vi.fn());
vi.mock("./probe-bundle-action", () => ({ probeBundleFreshness: probeMock }));

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";
import {
  getSavedBundle,
  putSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { revalidateSavedBundle } from "./revalidate-saved-bundle";

const snap = (updatedAt: string): unknown => ({
  lecture: { id: "l1", title: "t", updated_at: updatedAt },
  tags: [],
  documents: [],
  comments: [],
});

function seed(opts: {
  status?: "complete" | "saving";
  updatedAt?: string;
  remoteStatus?: "stale" | "gone";
  freshnessToken?: string;
}) {
  const {
    status = "complete",
    updatedAt = "2026-06-10T00:00:00Z",
    remoteStatus,
    freshnessToken,
  } = opts;
  return putSavedBundle({
    entity: "lectures",
    id: "l1",
    savedAt: "2026-06-10T00:00:00.000Z",
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    status,
    snapshot: snap(updatedAt),
    imageKeys: [],
    ...(remoteStatus ? { remoteStatus } : {}),
    ...(freshnessToken ? { freshnessToken } : {}),
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  probeMock.mockReset();
});

describe("revalidateSavedBundle", () => {
  it("нет записи → skip, проба не зовётся", async () => {
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("incomplete-запись → skip, проба не зовётся", async () => {
    await seed({ status: "saving" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("проба skip → skip, запись не тронута", async () => {
    await seed({});
    probeMock.mockResolvedValue({ status: "skip" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("проба skip при существующей пометке → пометка сохраняется", async () => {
    await seed({ remoteStatus: "stale" });
    probeMock.mockResolvedValue({ status: "skip" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBe("stale");
  });

  it("проба fresh → fresh, снимает прежнюю пометку", async () => {
    await seed({ remoteStatus: "stale", freshnessToken: '"v1"' });
    probeMock.mockResolvedValue({ status: "fresh" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("проба stale(token) → stale + новый freshnessToken", async () => {
    await seed({ freshnessToken: '"v1"' });
    probeMock.mockResolvedValue({ status: "stale", freshnessToken: '"v2"' });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("stale");
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("stale");
    expect(rec?.freshnessToken).toBe('"v2"');
  });

  it("проба gone → gone, снимок цел", async () => {
    await seed({});
    probeMock.mockResolvedValue({ status: "gone" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("gone");
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("gone");
    expect(rec?.snapshot).toBeTruthy();
  });

  it("проба marker + изменённый маркер → stale", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z" });
    probeMock.mockResolvedValue({ status: "marker", marker: "2026-06-12T00:00:00Z" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("stale");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBe("stale");
  });

  it("проба marker + тот же маркер → fresh, снимает пометку", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z", remoteStatus: "stale" });
    probeMock.mockResolvedValue({ status: "marker", marker: "2026-06-10T00:00:00Z" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("CAS: снимок обновлён во время пробы → marker не штампует stale", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z" });
    probeMock.mockImplementation(async () => {
      await putSavedBundle({
        entity: "lectures",
        id: "l1",
        savedAt: "2026-06-12T00:00:00.000Z",
        schemaVersion: OFFLINE_SCHEMA_VERSION,
        status: "complete",
        snapshot: snap("2026-06-12T00:00:00Z"),
        imageKeys: [],
      });
      return { status: "marker", marker: "2026-06-12T00:00:00Z" };
    });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("проба бросает → skip (best-effort, не пробрасывает)", async () => {
    await seed({});
    probeMock.mockRejectedValue(new Error("boom"));
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
  });

  it("marker, но в снимке нет updated_at → fresh (не штампует ложный stale)", async () => {
    await putSavedBundle({
      entity: "lectures",
      id: "l1",
      savedAt: "2026-06-10T00:00:00.000Z",
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      status: "complete",
      snapshot: { lecture: { id: "l1", title: "t" }, tags: [], documents: [], comments: [] },
      imageKeys: [],
    });
    probeMock.mockResolvedValue({ status: "marker", marker: "2026-06-12T00:00:00Z" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });
});
