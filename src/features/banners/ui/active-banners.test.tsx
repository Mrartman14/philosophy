// src/features/banners/ui/active-banners.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({ getT: () => Promise.resolve((k: string) => k) }));
vi.mock("@/utils/me", () => ({ getMe: () => Promise.resolve(null) }));
vi.mock("@/components/ast-render", () => ({ AstRender: () => null }));
vi.mock("../api", () => ({ getActiveBanners: vi.fn() }));

import { getActiveBanners } from "../api";

import { ActiveBanners } from "./active-banners";

afterEach(cleanup);

describe("ActiveBanners", () => {
  it("красит баннер классом варианта, без inline-стиля (CSP style-src-attr)", async () => {
    vi.mocked(getActiveBanners).mockResolvedValue([
      { id: "b1", variant: "warning", blocks: [], dismissible: false },
    ]);
    const { container } = render(await ActiveBanners());
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- класс-селектор баннера, семантической роли нет
    const el = container.querySelector(".banner--warning");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("style")).toBeNull();
  });

  it("вариант не задан → дефолтный класс banner--info", async () => {
    vi.mocked(getActiveBanners).mockResolvedValue([
      { id: "b2", blocks: [], dismissible: false },
    ]);
    const { container } = render(await ActiveBanners());
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- класс-селектор баннера, семантической роли нет
    expect(container.querySelector(".banner--info")).not.toBeNull();
  });
});
