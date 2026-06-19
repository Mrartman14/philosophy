import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";

const probeMock = vi.hoisted(() => vi.fn());
vi.mock("./probe-lecture-action", () => ({ probeLectureForOffline: probeMock }));

const manifestMock = vi.hoisted(() => vi.fn());
vi.mock("./probe-lecture-manifest-action", () => ({
  probeLectureManifest: manifestMock,
}));

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
  manifestMock.mockReset();
});

describe("revalidateSavedLecture — legacy-путь (без freshnessToken)", () => {
  it("нет записи → skip, probe не зовётся", async () => {
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
    expect(manifestMock).not.toHaveBeenCalled();
  });

  it("incomplete-запись → skip, probe не зовётся", async () => {
    await seed({ status: "saving" });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
    expect(manifestMock).not.toHaveBeenCalled();
  });

  it("probe success:false (сеть) → skip, запись не тронута", async () => {
    await seed({});
    probeMock.mockResolvedValue({ success: false, error: "network" });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("probe success:false при существующей пометке → пометка сохраняется", async () => {
    await seed({ remoteStatus: "stale" });
    probeMock.mockResolvedValue({ success: false, error: "network" });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBe("stale");
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

  it("снимок обновлён во время probe (ручной «Обновить») → CAS не штампует stale", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z" });
    // Симуляция гонки: пока шёл probe, ручной «Обновить» перезаписал снимок
    // свежим (updated_at=12) — таким же, как вернёт probe. Копия уже актуальна.
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
      return {
        success: true,
        data: { status: "present", updatedAt: "2026-06-12T00:00:00Z" },
      };
    });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
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

  it("probe бросает → skip, наружу не пробрасывает (best-effort)", async () => {
    await seed({});
    probeMock.mockRejectedValue(new Error("db error"));
    expect(await revalidateSavedLecture("l1")).toBe("skip");
  });
});

describe("revalidateSavedLecture — manifest-путь (freshnessToken присутствует)", () => {
  it("manifest → fresh: возвращает fresh, legacy probe НЕ вызывается", async () => {
    await seed({ freshnessToken: '"etag-v1"' });
    manifestMock.mockResolvedValue({ status: "fresh" });

    expect(await revalidateSavedLecture("l1")).toBe("fresh");
    expect(manifestMock).toHaveBeenCalledWith("l1", '"etag-v1"');
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("manifest → fresh: снимает прежний remoteStatus", async () => {
    await seed({ freshnessToken: '"etag-v1"', remoteStatus: "stale" });
    manifestMock.mockResolvedValue({ status: "fresh" });

    expect(await revalidateSavedLecture("l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("manifest → stale: remoteStatus=stale + новый freshnessToken сохранены, legacy probe НЕ зовётся", async () => {
    await seed({ freshnessToken: '"etag-v1"' });
    manifestMock.mockResolvedValue({ status: "stale", freshnessToken: '"etag-v2"' });

    expect(await revalidateSavedLecture("l1")).toBe("stale");
    expect(probeMock).not.toHaveBeenCalled();
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("stale");
    expect(rec?.freshnessToken).toBe('"etag-v2"');
  });

  it("manifest → gone: remoteStatus=gone, снимок цел, legacy probe НЕ зовётся", async () => {
    await seed({ freshnessToken: '"etag-v1"' });
    manifestMock.mockResolvedValue({ status: "gone" });

    expect(await revalidateSavedLecture("l1")).toBe("gone");
    expect(probeMock).not.toHaveBeenCalled();
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("gone");
    expect(rec?.snapshot).toBeTruthy();
  });

  it("manifest → skip: фолбэк на legacy probe (freshnessToken есть, но manifest вернул skip)", async () => {
    await seed({ freshnessToken: '"etag-v1"', updatedAt: "2026-06-10T00:00:00Z" });
    manifestMock.mockResolvedValue({ status: "skip" });
    probeMock.mockResolvedValue({
      success: true,
      data: { status: "present", updatedAt: "2026-06-12T00:00:00Z" },
    });

    expect(await revalidateSavedLecture("l1")).toBe("stale");
    expect(probeMock).toHaveBeenCalled();
  });

  it("manifest бросает → skip (best-effort, не пробрасывает)", async () => {
    await seed({ freshnessToken: '"etag-v1"' });
    manifestMock.mockRejectedValue(new Error("network"));

    expect(await revalidateSavedLecture("l1")).toBe("skip");
  });
});
