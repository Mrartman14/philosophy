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

  it("applies the fixed base class and rejects className", () => {
    render(
      // @ts-expect-error -- className закрыт (Omit): раскладка/стиль вокруг метки — на родителе
      <Label className="custom-x">L</Label>,
    );
    const label = screen.getByText("L");
    expect(label).toHaveClass("text-sm", "font-medium");
  });
});
