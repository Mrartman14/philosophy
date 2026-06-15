// src/components/ui/router-link.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Изолируем юнит: вне Next-runtime рендерим NextLink как обычный <a>,
// а useLinkStatus возвращает idle (RouterLinkBusy → null).
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

import { RouterLink } from "./router-link";

afterEach(cleanup);

describe("RouterLink", () => {
  it("пробрасывает href и ставит класс router-link по умолчанию", () => {
    render(<RouterLink href="/lectures/1">Лекция</RouterLink>);
    const a = screen.getByRole("link", { name: "Лекция" });
    expect(a).toHaveAttribute("href", "/lectures/1");
    expect(a).toHaveClass("router-link");
  });

  it("сливает пользовательский className через cn", () => {
    render(
      <RouterLink href="/x" className="text-sm font-bold">
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveClass(
      "router-link",
      "text-sm",
      "font-bold",
    );
  });

  it("selfBusyIndicator={false} → без класса router-link", () => {
    render(
      <RouterLink href="/x" selfBusyIndicator={false}>
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).not.toHaveClass("router-link");
  });

  it("target=_blank → авто rel=noopener noreferrer", () => {
    render(
      <RouterLink href="/x" target="_blank">
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("явный rel не перезаписывается авто-noopener", () => {
    render(
      <RouterLink href="/x" target="_blank" rel="nofollow">
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute("rel", "nofollow");
  });
});
