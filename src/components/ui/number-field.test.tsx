import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NumberField } from "./number-field";

afterEach(cleanup);

describe("NumberField", () => {
  it("controlled: показывает числовое value на внутреннем input", () => {
    render(<NumberField aria-label="ширина" value={42} onValueChange={vi.fn()} />);
    expect(screen.getByLabelText<HTMLInputElement>("ширина")).toHaveValue("42");
  });

  it("id/aria-label садятся на <input>, а не на групп-обёртку", () => {
    render(<NumberField id="w" aria-label="ширина" value={0} onValueChange={vi.fn()} />);
    const input = screen.getByLabelText("ширина");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("id", "w");
  });

  it("onValueChange отдаёт ЧИСЛО (а не строку) при вводе", () => {
    const onValueChange = vi.fn();
    render(<NumberField aria-label="ширина" value={0} onValueChange={onValueChange} />);
    const input = screen.getByLabelText("ширина");
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalled();
    const lastArg = onValueChange.mock.calls.at(-1)?.[0] as unknown;
    expect(typeof lastArg).toBe("number");
    expect(lastArg).toBe(25);
  });

  it("forwards ref на внутренний <input>", () => {
    const ref = createRef<HTMLInputElement>();
    render(<NumberField ref={ref} aria-label="ширина" value={1} onValueChange={vi.fn()} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
