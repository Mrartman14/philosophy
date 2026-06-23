// src/components/shared/nav-rail.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Вне Next-runtime: NextLink → обычный <a>, useLinkStatus → idle (RouterLinkBusy → null).
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  useLinkStatus: () => ({ pending: false }),
}));

let pathname = "/me/documents";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { NavRail } from "./nav-rail";

const ITEMS = [
  { href: "/me/documents", label: "Документы" },
  { href: "/me/media", label: "Медиа" },
  { href: "/me/tokens", label: "Токены" },
];

afterEach(cleanup);

describe("NavRail", () => {
  it("рендерит все пункты и aria-label на <nav>", () => {
    pathname = "/me/documents";
    render(<NavRail items={ITEMS} ariaLabel="Меню кабинета" />);
    expect(
      screen.getByRole("navigation", { name: "Меню кабинета" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("ставит aria-current=page только на активном пункте (prefix-матч вложенного пути)", () => {
    pathname = "/me/documents/42";
    render(<NavRail items={ITEMS} ariaLabel="nav" />);
    expect(screen.getByRole("link", { name: "Документы" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Медиа" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("match=exact не подсвечивает вложенный путь", () => {
    pathname = "/me/documents/42";
    render(<NavRail items={ITEMS} ariaLabel="nav" match="exact" />);
    expect(screen.getByRole("link", { name: "Документы" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("orientation переключает layout-классы <nav>", () => {
    pathname = "/x";
    const { rerender } = render(
      <NavRail items={ITEMS} ariaLabel="nav" orientation="vertical" />,
    );
    expect(screen.getByRole("navigation")).toHaveClass("flex-col");
    rerender(<NavRail items={ITEMS} ariaLabel="nav" orientation="responsive" />);
    expect(screen.getByRole("navigation")).toHaveClass("flex-wrap");
  });
});
