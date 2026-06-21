import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TextInput } from "./text-input";

afterEach(cleanup);

describe("TextInput", () => {
  it("по умолчанию (без grow) не растягивается — нет flex-1", () => {
    render(<TextInput aria-label="строка" />);
    const input = screen.getByLabelText("строка");
    expect(input).not.toHaveClass("flex-1");
    expect(input).not.toHaveClass("min-w-0");
  });

  it("grow добавляет flex-1 min-w-0 (растяжение в Inline-ряду)", () => {
    render(<TextInput grow aria-label="строка" />);
    const input = screen.getByLabelText("строка");
    expect(input).toHaveClass("flex-1");
    expect(input).toHaveClass("min-w-0");
  });

  it("type по умолчанию text; name/defaultValue прокидываются", () => {
    render(<TextInput name="q" defaultValue="привет" aria-label="строка" />);
    const input = screen.getByLabelText<HTMLInputElement>("строка");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("name", "q");
    expect(input.value).toBe("привет");
  });
});
