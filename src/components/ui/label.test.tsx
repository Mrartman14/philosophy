import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Label } from "./label";

afterEach(cleanup);

describe("Label", () => {
  it("renders text and forwards htmlFor", () => {
    render(<Label htmlFor="email">Почта</Label>);
    const label = screen.getByText("Почта");
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute("for", "email");
  });

  it("merges custom className over the base", () => {
    render(<Label className="custom-x">L</Label>);
    expect(screen.getByText("L")).toHaveClass("custom-x");
  });
});
