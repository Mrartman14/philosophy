import { describe, it, expect, beforeEach, vi } from "vitest";

const resolveDescriptor = vi.hoisted(() => vi.fn());
vi.mock("./registry", () => ({ resolveDescriptor }));

import { captureFreshnessToken, probeBundleFreshness } from "./probe-bundle-action";

const probeManifest = vi.fn();
const probeMarker = vi.fn();

beforeEach(() => {
  resolveDescriptor.mockReset();
  probeManifest.mockReset();
  probeMarker.mockReset();
  resolveDescriptor.mockReturnValue({ freshness: { probeManifest, probeMarker } });
});

describe("probeBundleFreshness", () => {
  it("нет дескриптора → skip", async () => {
    resolveDescriptor.mockReturnValue(undefined);
    expect(await probeBundleFreshness("x", "1", undefined)).toEqual({ status: "skip" });
  });

  it("нет freshness → skip", async () => {
    resolveDescriptor.mockReturnValue({});
    expect(await probeBundleFreshness("x", "1", undefined)).toEqual({ status: "skip" });
  });

  it("token + manifest != skip → результат manifest, probeMarker НЕ зовётся", async () => {
    probeManifest.mockResolvedValue({ status: "stale", freshnessToken: '"v2"' });
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({
      status: "stale",
      freshnessToken: '"v2"',
    });
    expect(probeManifest).toHaveBeenCalledWith("l1", '"v1"');
    expect(probeMarker).not.toHaveBeenCalled();
  });

  it("token + manifest skip → fallback на probeMarker", async () => {
    probeManifest.mockResolvedValue({ status: "skip" });
    probeMarker.mockResolvedValue({ status: "present", marker: "2026-06-12" });
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({
      status: "marker",
      marker: "2026-06-12",
    });
  });

  it("без token → manifest НЕ зовётся, сразу probeMarker", async () => {
    probeMarker.mockResolvedValue({ status: "present", marker: "2026-06-12" });
    expect(await probeBundleFreshness("lectures", "l1", undefined)).toEqual({
      status: "marker",
      marker: "2026-06-12",
    });
    expect(probeManifest).not.toHaveBeenCalled();
  });

  it("probeMarker gone → gone", async () => {
    probeMarker.mockResolvedValue({ status: "gone" });
    expect(await probeBundleFreshness("lectures", "l1", undefined)).toEqual({ status: "gone" });
  });

  it("probeMarker skip → skip", async () => {
    probeMarker.mockResolvedValue({ status: "skip" });
    expect(await probeBundleFreshness("lectures", "l1", undefined)).toEqual({ status: "skip" });
  });

  it("нет probeMarker + manifest skip → skip", async () => {
    resolveDescriptor.mockReturnValue({ freshness: { probeManifest } });
    probeManifest.mockResolvedValue({ status: "skip" });
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({ status: "skip" });
  });

  it("probeManifest бросает → skip (best-effort)", async () => {
    probeManifest.mockRejectedValue(new Error("x"));
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({ status: "skip" });
  });
});

describe("captureFreshnessToken", () => {
  it("manifest stale → токен", async () => {
    probeManifest.mockResolvedValue({ status: "stale", freshnessToken: '"v1"' });
    expect(await captureFreshnessToken("lectures", "l1")).toBe('"v1"');
  });

  it("manifest fresh → null", async () => {
    probeManifest.mockResolvedValue({ status: "fresh" });
    expect(await captureFreshnessToken("lectures", "l1")).toBeNull();
  });

  it("нет freshness → null", async () => {
    resolveDescriptor.mockReturnValue({});
    expect(await captureFreshnessToken("lectures", "l1")).toBeNull();
  });

  it("бросает → null", async () => {
    probeManifest.mockRejectedValue(new Error("x"));
    expect(await captureFreshnessToken("lectures", "l1")).toBeNull();
  });
});
