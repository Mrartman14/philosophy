import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SidebarLayout, SIDEBAR_ASIDE_CLASS, SIDEBAR_LAYOUT_CLASS } from "./sidebar-layout";

afterEach(cleanup);

describe("SidebarLayout", () => {
  it("раскладка responsive: колонка на мобиле, ряд на lg", () => {
    expect(SIDEBAR_LAYOUT_CLASS).toContain("flex");
    expect(SIDEBAR_LAYOUT_CLASS).toContain("flex-col");
    expect(SIDEBAR_LAYOUT_CLASS).toContain("lg:flex-row");
  });

  it("aside: на мобиле обычный блок (НЕ sticky), на lg — sticky боковая колонка", () => {
    // sticky только с lg: — на мобиле сайдбар скроллится со страницей.
    expect(SIDEBAR_ASIDE_CLASS).toContain("lg:sticky");
    expect(SIDEBAR_ASIDE_CLASS).toContain("lg:top-(--header-height)");
    expect(SIDEBAR_ASIDE_CLASS).not.toMatch(/(^|\s)sticky(\s|$)/); // нет безусловного sticky
  });

  it("aside: без фона, логические бордеры (border-b мобайл → lg:border-e)", () => {
    expect(SIDEBAR_ASIDE_CLASS).not.toContain("bg-"); // фон не нужен (нет sticky-маски)
    expect(SIDEBAR_ASIDE_CLASS).toContain("border-b");
    expect(SIDEBAR_ASIDE_CLASS).toContain("lg:border-e");
    expect(SIDEBAR_ASIDE_CLASS).not.toMatch(/border-[lr]\b/); // нет физических left/right
  });

  it("рендерит nav в <aside> (complementary) и контент рядом", () => {
    render(
      <SidebarLayout nav={<span>NAV</span>}>
        <p>CONTENT</p>
      </SidebarLayout>,
    );
    const aside = screen.getByRole("complementary");
    expect(aside.tagName).toBe("ASIDE");
    expect(aside).toHaveTextContent("NAV");
    expect(screen.getByText("CONTENT")).toBeInTheDocument();
  });
});
