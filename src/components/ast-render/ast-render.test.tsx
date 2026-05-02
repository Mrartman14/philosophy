// src/components/ast-render/ast-render.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AstRender } from "./ast-render";
import {
  PARAGRAPH_PLAIN,
  PARAGRAPH_WITH_BOLD,
  PARAGRAPH_WITH_HARD_BREAK,
} from "./__fixtures__/blocks";

describe("AstRender — paragraph + inline marks", () => {
  it("рендерит plain paragraph", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_PLAIN]} />);
    expect(container.querySelector("p")?.textContent).toBe("Простой текст.");
  });

  it("оборачивает текст в <strong> для mark bold", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_BOLD]} />);
    expect(container.querySelector("p strong")?.textContent).toBe("слово");
  });

  it("рендерит hard_break как <br>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_HARD_BREAK]} />);
    expect(container.querySelectorAll("p br")).toHaveLength(1);
  });
});
