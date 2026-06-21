import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders a styled control by default", () => {
    render(<Button>Жми</Button>);
    const btn = screen.getByRole("button", { name: "Жми" });
    expect(btn).toHaveAttribute("type", "button");
    // Базовая геометрия/раскладка контрола присутствует.
    expect(btn).toHaveClass("inline-flex");
  });

  it("default size binds to the comfortable control-height token", () => {
    render(<Button>x</Button>);
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("h-(--size-control-h-md)");
  });

  it("compact binds to the small control-height token", () => {
    render(<Button compact>x</Button>);
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("h-(--size-control-h-sm)");
  });

  it("unstyled drops geometry/layout base, keeps caller className", () => {
    render(
      <Button unstyled className="custom-x">
        x
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "x" });
    // Реальная кнопка с типом по умолчанию.
    expect(btn).toHaveAttribute("type", "button");
    // Класс вызывающего сохранён.
    expect(btn).toHaveClass("custom-x");
    // Никакой базовой геометрии/раскладки — вызывающий полностью владеет ею.
    expect(btn).not.toHaveClass("inline-flex");
    expect(btn).not.toHaveClass("items-center");
    expect(btn).not.toHaveClass("h-(--size-control-h-md)");
  });
});
