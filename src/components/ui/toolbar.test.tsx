import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Toolbar } from "./toolbar";

afterEach(cleanup);

describe("Toolbar (compound)", () => {
  it("renders a toolbar with a button", () => {
    render(
      <Toolbar.Root>
        <Toolbar.Group>
          <Toolbar.Button aria-label="bold">B</Toolbar.Button>
        </Toolbar.Group>
      </Toolbar.Root>,
    );
    expect(screen.getByRole("button", { name: "bold" })).toBeInTheDocument();
  });

  it("Button height binds to the density-aware control token, not a literal", () => {
    render(
      <Toolbar.Root>
        <Toolbar.Button aria-label="b">B</Toolbar.Button>
      </Toolbar.Root>,
    );
    const btn = screen.getByRole("button", { name: "b" });
    expect(btn).toHaveClass("h-(--size-control-h-md)");
    expect(btn).toHaveClass("min-w-(--size-control-h-md)");
    // Регресс-гард: больше не литерал h-9 (density-aware токен вместо фикс-px).
    expect(btn).not.toHaveClass("h-9");
  });

  it("Button merges custom className over the default", () => {
    render(
      <Toolbar.Root>
        <Toolbar.Button aria-label="x" className="custom-x">X</Toolbar.Button>
      </Toolbar.Root>,
    );
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("custom-x");
  });

  it("forwards ref to the underlying <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Toolbar.Root>
        <Toolbar.Button ref={ref} aria-label="b">B</Toolbar.Button>
      </Toolbar.Root>,
    );
    expect(ref.current?.tagName).toBe("BUTTON");
  });
});
