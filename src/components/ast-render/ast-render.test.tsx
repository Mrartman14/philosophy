// src/components/ast-render/ast-render.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  PARAGRAPH_PLAIN,
  PARAGRAPH_WITH_BOLD,
  PARAGRAPH_WITH_HARD_BREAK,
  HEADING_LEVEL_1,
  HEADING_LEVEL_3,
  HEADING_NO_LEVEL,
  BULLET_LIST,
  BULLET_LIST_WITH_MARKS,
  NESTED_LIST,
  ORDERED_LIST,
  BLOCKQUOTE,
  BLOCKQUOTE_MULTI,
  THEMATIC_BREAK,
  TABLE,
  TABLE_WITH_ALIGN,
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
  PARAGRAPH_WITH_EMPTY_REF,
  PARAGRAPH_WITH_PROTOCOL_RELATIVE_LINK,
  PARAGRAPH_WITH_MEDIA_REF,
  PARAGRAPH_WITH_COMMENT_REF,
} from "./__fixtures__/blocks";
import { AstRender } from "./ast-render";

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

describe("AstRender — flow-контракт (.content > * прямые дети)", () => {
  // Регрессия: ранее AstRender оборачивал блоки в <div class="ast-render">.
  // Эта прослойка рвала прямой родитель→ребёнок между .content и блоками, из-за
  // чего ВСЕ flow-селекторы content.css (.content > * + *, > :is(h1,h2,h3),
  // > :is(ul,ol) > li + li) переставали матчить → пропадал вертикальный ритм.
  // jsdom не считает CSS, поэтому стережём именно структуру: никакой обёртки,
  // блоки — прямые дети контейнера, на который консьюмер вешает .content.
  it("не вводит обёртку между .content и блоками", () => {
    const { container } = render(
      <AstRender blocks={[HEADING_LEVEL_1, PARAGRAPH_PLAIN]} />,
    );
    expect(container.querySelector("div.ast-render")).toBeNull();
    const directChildren = Array.from(container.children).map((el) =>
      el.tagName.toLowerCase(),
    );
    expect(directChildren).toEqual(["h1", "p"]);
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

  it("проставляет id заголовку из block.id", () => {
    const { container } = render(<AstRender blocks={[HEADING_LEVEL_1]} />);
    expect(container.querySelector("h1")?.id).toBe("h1");
  });

  it("без block.id заголовок не получает id", () => {
    const block: import("./types").AstBlock = {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Без id" }],
    };
    const { container } = render(<AstRender blocks={[block]} />);
    expect(container.querySelector("h2")?.getAttribute("id")).toBeNull();
  });
});

describe("AstRender — list", () => {
  it("рендерит bullet-list как <ul> с текстом пунктов", () => {
    const { container } = render(<AstRender blocks={[BULLET_LIST]} />);
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("ul > li")?.textContent).toBe("Первый");
  });

  it("оборачивает содержимое пункта в <li><p> (паритет с редактором)", () => {
    const { container } = render(<AstRender blocks={[BULLET_LIST]} />);
    expect(container.querySelector("ul > li > p")?.textContent).toBe("Первый");
  });

  it("не оставляет нерендеренных нод (нет data-unsupported)", () => {
    const { container } = render(<AstRender blocks={[BULLET_LIST]} />);
    expect(container.querySelectorAll("[data-unsupported]")).toHaveLength(0);
  });

  it("рендерит ordered-list как <ol>", () => {
    const { container } = render(<AstRender blocks={[ORDERED_LIST]} />);
    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelectorAll("ol > li")).toHaveLength(1);
    expect(container.querySelector("ol > li > p")?.textContent).toBe("Один");
  });

  it("рендерит inline-mark (code) внутри пункта списка", () => {
    const { container } = render(<AstRender blocks={[BULLET_LIST_WITH_MARKS]} />);
    expect(container.querySelector("li > p > code")?.textContent).toBe("git stash");
    expect(container.querySelectorAll("[data-unsupported]")).toHaveLength(0);
  });

  it("рендерит вложенный список рекурсивно как блок", () => {
    const { container } = render(<AstRender blocks={[NESTED_LIST]} />);
    expect(container.querySelector("ul > li > ul > li > p")?.textContent).toBe("Вложенный");
    expect(container.querySelectorAll("[data-unsupported]")).toHaveLength(0);
  });
});

describe("AstRender — blockquote", () => {
  it("рендерит blockquote с вложенным параграфом", () => {
    const { container } = render(<AstRender blocks={[BLOCKQUOTE]} />);
    expect(container.querySelector("blockquote > p")?.textContent).toBe("Цитата.");
    expect(container.querySelectorAll("[data-unsupported]")).toHaveLength(0);
  });

  it("рендерит несколько блоков внутри blockquote", () => {
    const { container } = render(<AstRender blocks={[BLOCKQUOTE_MULTI]} />);
    const paras = container.querySelectorAll("blockquote > p");
    expect(paras).toHaveLength(2);
    expect(paras[1]?.textContent).toBe("Второй абзац.");
  });
});

describe("AstRender — thematic_break", () => {
  it("рендерит thematic_break как <hr>", () => {
    const { container } = render(<AstRender blocks={[THEMATIC_BREAK]} />);
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelectorAll("[data-unsupported]")).toHaveLength(0);
  });
});

describe("AstRender — table", () => {
  it("рендерит <table> с header-строкой как <th scope=col>", () => {
    const { container } = render(<AstRender blocks={[TABLE]} />);
    expect(container.querySelector("table")).not.toBeNull();
    const ths = container.querySelectorAll("table th");
    expect(ths).toHaveLength(2);
    expect(ths[0]?.textContent).toBe("Слой");
    expect(ths[0]?.getAttribute("scope")).toBe("col");
  });

  it("body-строки → <td>, inline-mark внутри ячейки рендерится", () => {
    const { container } = render(<AstRender blocks={[TABLE]} />);
    const tds = container.querySelectorAll("table td");
    expect(tds).toHaveLength(2);
    expect(tds[0]?.textContent).toBe("Стили");
    expect(container.querySelector("table td strong")?.textContent).toBe("v4");
  });

  it("не оставляет нерендеренных нод (нет data-unsupported)", () => {
    const { container } = render(<AstRender blocks={[TABLE]} />);
    expect(container.querySelectorAll("[data-unsupported]")).toHaveLength(0);
  });

  it("пробрасывает align ячейки в data-align", () => {
    const { container } = render(<AstRender blocks={[TABLE_WITH_ALIGN]} />);
    const tds = container.querySelectorAll("td");
    expect(tds[0]?.getAttribute("data-align")).toBe("center");
    expect(tds[1]?.getAttribute("data-align")).toBe("right");
  });

  it("ячейка без align не получает атрибут data-align", () => {
    const { container } = render(<AstRender blocks={[TABLE]} />);
    expect(container.querySelector("td")?.hasAttribute("data-align")).toBe(false);
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

  // INTENDED (map-driven): невалидный/отсутствующий storage_key → пустой
  // <figure> без <img> (ast-content-map NODE_MAP.image — единый SOT). Ранее
  // read-рендерер давал <div data-unsupported="image">; <figure> — паритет с
  // редактором, без инъекции (STORAGE_KEY_RE отклоняет ключ).
  it("без storage_key → пустой <figure> без <img>", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_NO_KEY]} />);
    expect(container.querySelector("img")).toBeNull();
    const figure = container.querySelector("figure");
    expect(figure).not.toBeNull();
    expect(figure?.childElementCount).toBe(0);
  });

  it("невалидный storage_key (не 64-hex) → пустой <figure> без <img>", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_INVALID_KEY]} />);
    expect(container.querySelector("img")).toBeNull();
    const figure = container.querySelector("figure");
    expect(figure).not.toBeNull();
    expect(figure?.childElementCount).toBe(0);
  });
});

describe("AstRender — ref-marks", () => {
  // INTENDED: nav-ref теперь несёт data-mark + class (паритет с редактором,
  // MARK_MAP единый SOT). Ранее read-рендерер давал голый <a href>.
  it("glossary_ref → <a href + data-mark + class nav-ref> (паритет с редактором)", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_GLOSSARY_REF]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/glossary/term-uuid-123");
    expect(a?.getAttribute("data-mark")).toBe("glossary_ref");
    expect(a?.className).toBe("nav-ref nav-ref--glossary_ref");
    expect(a?.textContent).toBe("термин");
  });

  it("ref с пустым id рендерится как plain text", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_EMPTY_REF]} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("пустой");
  });

  it("media_ref → <a href + data-mark + class nav-ref>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_MEDIA_REF]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/media/med-uuid-789");
    expect(a?.getAttribute("data-mark")).toBe("media_ref");
    expect(a?.className).toBe("nav-ref nav-ref--media_ref");
    expect(a?.textContent).toBe("запись");
  });

  it("comment_ref → <a href + data-mark + class nav-ref>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_COMMENT_REF]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/comments/com-uuid-012");
    expect(a?.getAttribute("data-mark")).toBe("comment_ref");
    expect(a?.className).toBe("nav-ref nav-ref--comment_ref");
  });
});

describe("AstRender — canvas_ref mark", () => {
  it("canvas_ref → <a href + data-mark + class nav-ref>", () => {
    const block: import("./types").AstBlock = {
      id: "p-cv",
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "canvas-ref",
          marks: [{ type: "canvas_ref", attrs: { id: "cv-uuid-345" } }],
        },
      ],
    };
    const { container } = render(<AstRender blocks={[block]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/canvases/cv-uuid-345");
    expect(a?.getAttribute("data-mark")).toBe("canvas_ref");
    expect(a?.className).toBe("nav-ref nav-ref--canvas_ref");
    expect(a?.textContent).toBe("canvas-ref");
  });
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
