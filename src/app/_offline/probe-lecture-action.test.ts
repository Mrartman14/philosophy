import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted: фабрика vi.mock хойстится выше const'ов.
const getLectureByIdMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/lectures", () => ({ getLectureById: getLectureByIdMock }));

import { probeLectureForOffline } from "./probe-lecture-action";

beforeEach(() => {
  getLectureByIdMock.mockReset();
});

describe("probeLectureForOffline", () => {
  it("лекция есть → success, data: present + updatedAt", async () => {
    getLectureByIdMock.mockResolvedValue({
      id: "l1",
      updated_at: "2026-06-10T00:00:00Z",
    });
    const res = await probeLectureForOffline({ id: "l1" });
    expect(res).toEqual({
      success: true,
      data: { status: "present", updatedAt: "2026-06-10T00:00:00Z" },
    });
  });

  it("404 (getLectureById → null) → success, data: gone", async () => {
    getLectureByIdMock.mockResolvedValue(null);
    const res = await probeLectureForOffline({ id: "l1" });
    expect(res).toEqual({ success: true, data: { status: "gone" } });
  });

  it("сетевой/5xx сбой (throw) → success: false", async () => {
    getLectureByIdMock.mockRejectedValue(new Error("network down"));
    const res = await probeLectureForOffline({ id: "l1" });
    expect(res.success).toBe(false);
  });
});
