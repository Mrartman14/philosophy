// src/components/ast-render/ast-render.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AstRender } from "./ast-render";
import {
  PARAGRAPH_PLAIN,
  PARAGRAPH_WITH_BOLD,
  PARAGRAPH_WITH_HARD_BREAK,
  HEADING_LEVEL_1,
  HEADING_LEVEL_3,
  HEADING_NO_LEVEL,
  BULLET_LIST,
  ORDERED_LIST,
  CODE_BLOCK,
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

describe("AstRender — heading", () => {
  it("рендерит heading level=1 как <h1>", () => {
    const { container } = render(<AstRender blocks={[HEADING_LEVEL_1]} />);
    expect(container.querySelector("h1")?.textContent).toBe("Главный заголовок");
  });

  it("рендерит heading level=3 как <h3>", () => {
    const { container } = render(<AstRender blocks={[HEADING_LEVEL_3]} />);
    expect(container.querySelector("h3")?.textContent).toBe("Подзаголовок");
  });

  it("без level или с невалидным level рендерит <h2>", () => {
    const { container } = render(<AstRender blocks={[HEADING_NO_LEVEL]} />);
    expect(container.querySelector("h2")?.textContent).toBe("Заголовок без уровня");
  });
});

describe("AstRender — list", () => {
  it("рендерит bullet-list как <ul>", () => {
    const { container } = render(<AstRender blocks={[BULLET_LIST]} />);
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("ul > li")?.textContent).toBe("Первый");
  });

  it("рендерит ordered-list как <ol>", () => {
    const { container } = render(<AstRender blocks={[ORDERED_LIST]} />);
    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelectorAll("ol > li")).toHaveLength(1);
  });
});

describe("AstRender — code_block", () => {
  it("рендерит code_block как <pre><code>", () => {
    const { container } = render(<AstRender blocks={[CODE_BLOCK]} />);
    const code = container.querySelector("pre > code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("const x = 1;\nconst y = 2;");
  });

  it("проставляет data-language из attrs", () => {
    const { container } = render(<AstRender blocks={[CODE_BLOCK]} />);
    expect(container.querySelector("pre")?.getAttribute("data-language")).toBe("ts");
  });
});
