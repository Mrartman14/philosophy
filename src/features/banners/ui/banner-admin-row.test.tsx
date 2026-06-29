// src/features/banners/ui/banner-admin-row.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({
  getT: () => Promise.resolve((k: string) => k),
  getLocale: () => Promise.resolve("ru"),
}));
vi.mock("@/utils/timezone-server", () => ({
  getServerTz: () => Promise.resolve("UTC"),
}));
vi.mock("./banner-delete-button", () => ({ BannerDeleteButton: () => null }));
vi.mock("./banner-export-links", () => ({ BannerExportLinks: () => null }));

import type { Banner } from "../types";

import { BannerAdminRow } from "./banner-admin-row";

afterEach(cleanup);

const banner: Banner = {
  id: "b1",
  variant: "danger",
  blocks: [{ text: "Текст" }],
  start_at: "2026-07-01T10:00:00Z",
  target_audience: "all",
};

describe("BannerAdminRow", () => {
  it("свотч окрашен классом варианта, без inline-стиля (CSP)", async () => {
    const { container } = render(
      await BannerAdminRow({ banner, canEdit: false, canDelete: false }),
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- класс-селектор свотча, семантической роли нет
    const swatch = container.querySelector(".banner--danger");
    expect(swatch).not.toBeNull();
    expect(swatch?.getAttribute("style")).toBeNull();
  });
});
