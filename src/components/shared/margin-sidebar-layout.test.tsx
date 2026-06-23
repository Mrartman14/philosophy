import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarginSidebarLayout } from "./margin-sidebar-layout";

afterEach(cleanup);

describe("MarginSidebarLayout", () => {
  it("нав в <aside class=margin-nav> (complementary), контент рядом", () => {
    render(
      <MarginSidebarLayout nav={<span>NAV</span>}>
        <p>CONTENT</p>
      </MarginSidebarLayout>,
    );
    const aside = screen.getByRole("complementary");
    expect(aside.tagName).toBe("ASIDE");
    expect(aside).toHaveClass("margin-nav"); // раскладка margin-nav из layout.css
    expect(aside).toHaveTextContent("NAV");
    expect(screen.getByText("CONTENT")).toBeInTheDocument();
  });

  it("рендерит фрагмент (nav и контент — siblings, без общей обёртки)", () => {
    const { container } = render(
      <MarginSidebarLayout nav={<span>NAV</span>}>
        <p>CONTENT</p>
      </MarginSidebarLayout>,
    );
    // структуру фрагмента (2 прямых грид-айтема: aside + контент) query-методами не
    // проверить — нужен прямой доступ к детям контейнера.
    // eslint-disable-next-line testing-library/no-node-access -- инвариант фрагмента: оба ребёнка — прямые потомки .page-grid
    const kids = container.children;
    expect(kids).toHaveLength(2);
    expect((kids[0] as HTMLElement).tagName).toBe("ASIDE");
  });
});
