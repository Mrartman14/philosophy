import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IconButton } from "./icon-button";

afterEach(cleanup);

describe("IconButton", () => {
  it("defaults to md geometry (36px)", () => {
    render(<IconButton aria-label="y" />);
    const btn = screen.getByRole("button", { name: "y" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("h-9");
    expect(btn).toHaveClass("w-9");
  });

  it("size=sm applies compact geometry (28px), not md", () => {
    render(<IconButton size="sm" aria-label="x" />);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toHaveClass("h-7");
    expect(btn).toHaveClass("w-7");
    expect(btn).not.toHaveClass("h-9");
    expect(btn).not.toHaveClass("w-9");
  });
});
