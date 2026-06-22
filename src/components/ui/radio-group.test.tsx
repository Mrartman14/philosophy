import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RadioGroup } from "./radio-group";

afterEach(cleanup);

const OPTIONS = [
  { value: "system", label: "Система" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];

describe("RadioGroup", () => {
  it("рендерит radiogroup с aria-label и по radio на опцию", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Тема" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("помечает текущее значение как checked", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Светлая" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Тёмная" })).not.toBeChecked();
  });

  it("клик по сегменту зовёт onValueChange с его value", () => {
    const onValueChange = vi.fn();
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Тёмная" }));
    expect(onValueChange).toHaveBeenCalledWith("dark");
  });
});
