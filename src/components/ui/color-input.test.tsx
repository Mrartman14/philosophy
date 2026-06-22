import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ColorInput } from "./color-input";
import { FormField } from "./form-field";

afterEach(cleanup);

describe("ColorInput", () => {
  it("renders a native color input with its label", () => {
    render(<ColorInput name="c" defaultValue="#ff0000" aria-label="Цвет" />);
    const input = screen.getByLabelText("Цвет");
    expect(input).toHaveAttribute("type", "color");
  });

  it("owns its square geometry (control-height token, no className prop)", () => {
    render(<ColorInput name="c" defaultValue="#ff0000" aria-label="Цвет" />);
    const input = screen.getByLabelText("Цвет");
    expect(input).toHaveClass("h-(--size-control-h-md)");
    expect(input).toHaveClass("w-16");
    expect(input).toHaveClass("cursor-pointer");
  });

  it("passes through name and defaultValue", () => {
    render(<ColorInput name="background_color" defaultValue="#336699" aria-label="Цвет" />);
    const input = screen.getByLabelText<HTMLInputElement>("Цвет");
    expect(input).toHaveAttribute("name", "background_color");
    expect(input.value).toBe("#336699");
  });

  it("внутри FormField наследует name из Field.Root без явного пропа", () => {
    render(
      <FormField name="background_color" label="Цвет">
        <ColorInput />
      </FormField>,
    );
    expect(screen.getByLabelText("Цвет")).toHaveAttribute("name", "background_color");
  });
});
