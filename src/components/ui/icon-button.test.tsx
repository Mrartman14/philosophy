import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IconButton } from "./icon-button";

afterEach(cleanup);

describe("IconButton", () => {
  it("renders a square control-height button (token-based, no size prop)", () => {
    render(<IconButton aria-label="x">i</IconButton>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("h-(--size-control-h-md)");
    expect(btn).toHaveClass("w-(--size-control-h-md)");
  });

  it("compact binds to the small control-height token", () => {
    render(<IconButton compact aria-label="x">i</IconButton>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toHaveClass("h-(--size-control-h-sm)");
    expect(btn).toHaveClass("w-(--size-control-h-sm)");
    expect(btn).not.toHaveClass("h-(--size-control-h-md)");
    expect(btn).not.toHaveClass("w-(--size-control-h-md)");
  });

  it("defaults to neutral tone: hover-only, no resting bg/border", () => {
    render(<IconButton aria-label="x">i</IconButton>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toHaveClass("hover:bg-(--color-surface-subtle)");
    // neutral is the natural-quiet tone: no resting fill, no border.
    expect(btn).not.toHaveClass("bg-(--color-fg)");
    expect(btn).not.toHaveClass("border");
  });

  it("tone='primary' is filled (fg bg, surface text)", () => {
    render(<IconButton tone="primary" aria-label="x">i</IconButton>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toHaveClass("bg-(--color-fg)");
    expect(btn).toHaveClass("text-(--color-surface)");
  });

  it("tone='danger' is textual (danger text, danger-bg hover)", () => {
    render(<IconButton tone="danger" aria-label="x">i</IconButton>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toHaveClass("text-(--color-danger)");
    expect(btn).toHaveClass("hover:bg-(--color-danger-bg)");
    // textual, not filled.
    expect(btn).not.toHaveClass("bg-(--color-fg)");
  });
});
