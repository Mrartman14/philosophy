import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";

const probeMock = vi.hoisted(() => vi.fn());
vi.mock("./probe-lecture-action", () => ({ probeLectureForOffline: probeMock }));

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";
import {
  getSavedBundle,
  putSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { revalidateSavedLecture } from "./revalidate-saved-lecture";

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
}) {
  const { status = "complete", updatedAt = "2026-06-10T00:00:00Z", remoteStatus } = opts;
  return putSavedBundle({
    entity: "lectures",
    id: "l1",
    savedAt: "2026-06-10T00:00:00.000Z",
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    status,
    snapshot: snap(updatedAt),
    imageKeys: [],
    ...(remoteStatus ? { remoteStatus } : {}),
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  probeMock.mockReset();
});

describe("revalidateSavedLecture", () => {
  it("нет записи → skip, probe не зовётся", async () => {
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("incomplete-запись → skip, probe не зовётся", async () => {
    await seed({ status: "saving" });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("probe success:false (сеть) → skip, запись не тронута", async () => {
    await seed({});
    probeMock.mockResolvedValue({ success: false, error: "network" });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("gone → пометка remoteStatus=gone, снимок цел", async () => {
    await seed({});
    probeMock.mockResolvedValue({ success: true, data: { status: "gone" } });
    expect(await revalidateSavedLecture("l1")).toBe("gone");
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("gone");
    expect(rec?.snapshot).toBeTruthy();
  });

  it("present + изменённый updated_at → stale", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z" });
    probeMock.mockResolvedValue({
      success: true,
      data: { status: "present", updatedAt: "2026-06-12T00:00:00Z" },
    });
    expect(await revalidateSavedLecture("l1")).toBe("stale");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBe("stale");
  });

  it("present + тот же updated_at → fresh, снимает прежнюю пометку", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z", remoteStatus: "stale" });
    probeMock.mockResolvedValue({
      success: true,
      data: { status: "present", updatedAt: "2026-06-10T00:00:00Z" },
    });
    expect(await revalidateSavedLecture("l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });
});
