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
  PARAGRAPH_WITH_LINK,
  PARAGRAPH_WITH_RELATIVE_LINK,
  PARAGRAPH_WITH_DANGEROUS_LINK,
  IMAGE_BLOCK,
  IMAGE_BLOCK_WITH_CAPTION,
  IMAGE_BLOCK_NO_KEY,
  IMAGE_BLOCK_INVALID_KEY,
  STORAGE_KEY_FIXTURE,
  PARAGRAPH_WITH_GLOSSARY_REF,
  PARAGRAPH_WITH_LECTURE_REF,
  PARAGRAPH_WITH_EMPTY_REF,
  PARAGRAPH_WITH_PROTOCOL_RELATIVE_LINK,
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

describe("AstRender — link mark + safety", () => {
  it("рендерит mark link как <a> с rel=noopener", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_LINK]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://anthropic.com");
    expect(a?.getAttribute("rel")).toContain("noopener");
    expect(a?.textContent).toBe("Anthropic");
  });

  it("разрешает относительные href", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_RELATIVE_LINK]} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/about");
  });

  it("javascript: URL рендерится как plain text без <a>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_DANGEROUS_LINK]} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("Опасная");
  });

  it("protocol-relative URL (//evil.com) рендерится как plain text", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_PROTOCOL_RELATIVE_LINK]} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("Phishing");
  });
});

describe("AstRender — image node", () => {
  it("рендерит <figure><img> с URL из resolveStorageUrl и alt", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK]} />);
    const img = container.querySelector("figure img");
    expect(img?.getAttribute("src")).toContain(`/static/files/${STORAGE_KEY_FIXTURE}`);
    expect(img?.getAttribute("alt")).toBe("Описание");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("рендерит figcaption при наличии caption", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_WITH_CAPTION]} />);
    expect(container.querySelector("figure figcaption")?.textContent).toBe("Подпись");
  });

  it("без storage_key рендерит data-unsupported (без <img>)", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_NO_KEY]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-unsupported='image']")).not.toBeNull();
  });

  it("невалидный storage_key (не 64-hex) отклоняется как unsupported", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_INVALID_KEY]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-unsupported='image']")).not.toBeNull();
  });
});

describe("AstRender — ref-marks", () => {
  it("default: glossary_ref → <a href='/glossary/{id}'>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_GLOSSARY_REF]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/glossary/term-uuid-123");
    expect(a?.textContent).toBe("термин");
  });

  it("default: lecture_ref → <a href='/lectures/{id}'>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_LECTURE_REF]} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/lectures/lec-uuid-456");
  });

  it("ctx.renderGlossaryRef переопределяет рендер", () => {
    const { container } = render(
      <AstRender
        blocks={[PARAGRAPH_WITH_GLOSSARY_REF]}
        ctx={{
          renderGlossaryRef: ({ id, label }) => (
            <span data-custom-glossary-ref={id}>{label}</span>
          ),
        }}
      />
    );
    expect(container.querySelector("a")).toBeNull();
    expect(
      container.querySelector("[data-custom-glossary-ref='term-uuid-123']")?.textContent
    ).toBe("термин");
  });

  it("ref с пустым id рендерится как plain text", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_EMPTY_REF]} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("пустой");
  });
});

describe("AstRender — unsupported marks fallback", () => {
  it("неизвестный mark рендерится как plain text с data-unsupported-mark", () => {
    const block: import("./types").AstBlock = {
      id: "p-unk",
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "media-ref",
          marks: [{ type: "media_ref", attrs: { id: "x" } }],
        },
      ],
    };
    const { container } = render(<AstRender blocks={[block]} />);
    expect(container.querySelector("[data-unsupported-mark='media_ref']")).not.toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("media-ref");
  });
});

describe("AstRender — exhaustive switch drift detection", () => {
  it.todo(
    "exhaustive switch detection: добавление нового block/mark type в OpenAPI " +
    "должно вызвать TS-ошибку в block-renderer.tsx default-case (через @ts-expect-error)"
  );
});

describe("AstRender — combo snapshot", () => {
  it("рендерит all-supported AST стабильно", () => {
    const { container } = render(
      <AstRender
        blocks={[
          HEADING_LEVEL_1,
          PARAGRAPH_PLAIN,
          PARAGRAPH_WITH_BOLD,
          PARAGRAPH_WITH_LINK,
          PARAGRAPH_WITH_GLOSSARY_REF,
          BULLET_LIST,
          CODE_BLOCK,
          IMAGE_BLOCK,
        ]}
      />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
