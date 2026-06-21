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
});
