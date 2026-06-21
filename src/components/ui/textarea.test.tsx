import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Textarea } from "./textarea";

afterEach(cleanup);

describe("Textarea", () => {
  it("по умолчанию (без grow/mono) — нет flex-1 и нет font-mono", () => {
    render(<Textarea aria-label="данные" />);
    const ta = screen.getByLabelText("данные");
    expect(ta).not.toHaveClass("flex-1");
    expect(ta).not.toHaveClass("min-h-0");
    expect(ta).not.toHaveClass("font-mono");
  });

  it("grow добавляет flex-1 min-h-0 (растяжение по высоте flex-колонки)", () => {
    render(<Textarea grow aria-label="данные" />);
    const ta = screen.getByLabelText("данные");
    expect(ta).toHaveClass("flex-1");
    expect(ta).toHaveClass("min-h-0");
  });

  it("mono добавляет font-mono text-xs (режим JSON/кода)", () => {
    render(<Textarea mono aria-label="данные" />);
    const ta = screen.getByLabelText("данные");
    expect(ta).toHaveClass("font-mono");
    expect(ta).toHaveClass("text-xs");
  });

  it("rows по умолчанию 4; name/defaultValue прокидываются", () => {
    render(<Textarea name="data" defaultValue="привет" aria-label="данные" />);
    const ta = screen.getByLabelText<HTMLTextAreaElement>("данные");
    expect(ta).toHaveAttribute("rows", "4");
    expect(ta).toHaveAttribute("name", "data");
    expect(ta.value).toBe("привет");
  });
});
