import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Inline, INLINE_CLASS } from "./inline";

afterEach(cleanup);

describe("Inline", () => {
  it("INLINE_CLASS is a wrapping horizontal row with the density-aware gap", () => {
    expect(INLINE_CLASS).toContain("flex");
    expect(INLINE_CLASS).toContain("flex-row");
    expect(INLINE_CLASS).toContain("flex-wrap");
    expect(INLINE_CLASS).toContain("gap-(--space-stack)");
  });
  it("renders its children", () => {
    render(<Inline><button type="button">a</button><button type="button">b</button></Inline>);
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "b" })).toBeInTheDocument();
  });
});
