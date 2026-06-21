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

  it("defaults to the primary tone (filled)", () => {
    render(<Button>x</Button>);
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("bg-(--color-fg)");
  });

  it("tone=neutral renders a bordered control", () => {
    render(<Button tone="neutral">x</Button>);
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("border");
  });

  it("tone=quiet is hover-only with no resting fill", () => {
    render(<Button tone="quiet">x</Button>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toHaveClass("hover:bg-(--color-surface-subtle)");
    // Никакой resting-заливки/бордера в quiet.
    expect(btn).not.toHaveClass("bg-(--color-surface-subtle)");
    expect(btn).not.toHaveClass("bg-(--color-fg)");
    expect(btn).not.toHaveClass("border");
  });

  it("tone=danger renders the danger-solid fill", () => {
    render(<Button tone="danger">x</Button>);
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("bg-(--color-danger-solid)");
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
