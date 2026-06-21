import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Stack, STACK_CLASS } from "./stack";

afterEach(cleanup);

describe("Stack", () => {
  it("STACK_CLASS is a vertical column with the density-aware stack gap", () => {
    expect(STACK_CLASS).toContain("flex");
    expect(STACK_CLASS).toContain("flex-col");
    expect(STACK_CLASS).toContain("gap-(--space-stack)");
  });
  it("renders its children", () => {
    render(<Stack><button type="button">a</button><button type="button">b</button></Stack>);
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "b" })).toBeInTheDocument();
  });
});
