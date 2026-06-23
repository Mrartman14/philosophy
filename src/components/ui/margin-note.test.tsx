import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarginNote, MARGIN_NOTE_SIDE } from "./margin-note";

afterEach(cleanup);

describe("MarginNote", () => {
  it("карта сторон использует логические колонки", () => {
    expect(MARGIN_NOTE_SIDE.start).toBe("col-margin-start");
    expect(MARGIN_NOTE_SIDE.end).toBe("col-margin-end");
  });

  it("рендерит <aside> (complementary) с классом стороны", () => {
    render(<MarginNote side="end">note</MarginNote>);
    const aside = screen.getByRole("complementary");
    expect(aside.tagName).toBe("ASIDE");
    expect(aside).toHaveClass("col-margin-end");
  });

  it("по умолчанию collapse=inline", () => {
    render(<MarginNote side="start">x</MarginNote>);
    expect(screen.getByRole("complementary")).toHaveClass("margin-note--inline");
  });

  it("collapse=hidden даёт класс скрытия", () => {
    render(<MarginNote side="start" collapse="hidden">x</MarginNote>);
    expect(screen.getByRole("complementary")).toHaveClass("margin-note--hidden");
  });

  it("прокидывает className и children (structural → className открыт)", () => {
    render(<MarginNote side="end" className="text-sm">payload</MarginNote>);
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("text-sm");
    expect(aside).toHaveTextContent("payload");
  });
});
