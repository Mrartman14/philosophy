import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));

import { DEFAULT_APPEARANCE } from "@/components/appearance/appearance-cookie";

import { getAppearance } from "./appearance";

describe("getAppearance", () => {
  beforeEach(() => cookieStore.get.mockReset());
  it("defaults when absent", async () => { cookieStore.get.mockReturnValue(undefined); expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE); });
  it("parses cookie", async () => { cookieStore.get.mockReturnValue({ value: JSON.stringify({ ...DEFAULT_APPEARANCE, theme: "dark" }) }); expect((await getAppearance()).theme).toBe("dark"); });
});
