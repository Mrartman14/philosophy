import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Checkbox } from "./checkbox";

afterEach(cleanup);

describe("Checkbox", () => {
  it("renders a checkbox with its accessible label", () => {
    render(<Checkbox aria-label="Согласие" />);
    expect(screen.getByRole("checkbox", { name: "Согласие" })).toBeInTheDocument();
  });

  it("owns its fixed 5x5 geometry (no className prop)", () => {
    render(<Checkbox aria-label="Согласие" />);
    const box = screen.getByRole("checkbox", { name: "Согласие" });
    expect(box).toHaveClass("h-5");
    expect(box).toHaveClass("w-5");
    expect(box).toHaveClass("inline-flex");
  });

  it("reflects defaultChecked state", () => {
    render(<Checkbox aria-label="Согласие" defaultChecked />);
    expect(screen.getByRole("checkbox", { name: "Согласие" })).toBeChecked();
  });

  // Closed surface: внешний className не часть контракта (CheckboxProps его не
  // объявляет). Раскладку держит родитель (Inline/обёртка), не сам Checkbox.
  it("rejects a className prop at the type level", () => {
    // @ts-expect-error — className удалён из CheckboxProps (Task 14)
    render(<Checkbox aria-label="Согласие" className="m-4" />);
    expect(screen.getByRole("checkbox", { name: "Согласие" })).toBeInTheDocument();
  });
});
