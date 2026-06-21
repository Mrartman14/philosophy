import { describe, it, expect } from "vitest";

import {
  parseTzCookie,
  serializeTzCookie,
  normalizeTzPref,
  isValidZone,
  FALLBACK_ZONE,
} from "./timezone";

describe("timezone cookie model", () => {
  it("validates IANA zones", () => {
    expect(isValidZone("Europe/Moscow")).toBe(true);
    expect(isValidZone("Mars/Phobos")).toBe(false);
    expect(isValidZone(42)).toBe(false);
  });

  it("normalizes preference: valid zone kept, junk → system", () => {
    expect(normalizeTzPref("Europe/Moscow")).toBe("Europe/Moscow");
    expect(normalizeTzPref("system")).toBe("system");
    expect(normalizeTzPref("garbage")).toBe("system");
    expect(normalizeTzPref(undefined)).toBe("system");
  });

  it("parses missing/invalid cookie to system + fallback", () => {
    expect(parseTzCookie(undefined)).toEqual({ pref: "system", resolved: FALLBACK_ZONE });
    expect(parseTzCookie("not-json")).toEqual({ pref: "system", resolved: FALLBACK_ZONE });
  });

  it("parses concrete zone: resolved forced to equal pref", () => {
    const raw = serializeTzCookie({ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" });
    expect(parseTzCookie(raw)).toEqual({ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" });
  });

  it("parses system: keeps a valid resolved zone, repairs invalid one to fallback", () => {
    const ok = serializeTzCookie({ pref: "system", resolved: "America/New_York" });
    expect(parseTzCookie(ok)).toEqual({ pref: "system", resolved: "America/New_York" });

    const bad = JSON.stringify({ pref: "system", resolved: "garbage" });
    expect(parseTzCookie(bad)).toEqual({ pref: "system", resolved: FALLBACK_ZONE });
  });
});
