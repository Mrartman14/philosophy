// src/components/ast-render/__fixtures__/blocks.ts
import type { AstBlock, AstNode } from "../types";

export const PARAGRAPH_PLAIN: AstBlock = {
  id: "p1",
  type: "paragraph",
  content: [{ type: "text", text: "Простой текст." }],
};

export const PARAGRAPH_WITH_BOLD: AstBlock = {
  id: "p2",
  type: "paragraph",
  content: [
    { type: "text", text: "Жирное " },
    { type: "text", text: "слово", marks: [{ type: "bold" }] },
    { type: "text", text: "." },
  ],
};

export const PARAGRAPH_WITH_HARD_BREAK: AstBlock = {
  id: "p3",
  type: "paragraph",
  content: [
    { type: "text", text: "Первая строка" },
    { type: "hard_break" },
    { type: "text", text: "Вторая строка" },
  ],
};

export const HEADING_LEVEL_1: AstBlock = {
  id: "h1",
  type: "heading",
  attrs: { level: 1 },
  content: [{ type: "text", text: "Главный заголовок" }],
};

export const HEADING_LEVEL_3: AstBlock = {
  id: "h3",
  type: "heading",
  attrs: { level: 3 },
  content: [{ type: "text", text: "Подзаголовок" }],
};

export const HEADING_NO_LEVEL: AstBlock = {
  id: "h0",
  type: "heading",
  attrs: {},
  content: [{ type: "text", text: "Заголовок без уровня" }],
};

export const BULLET_LIST: AstBlock = {
  id: "ul1",
  type: "list",
  attrs: { kind: "bullet" },
  content: [
    {
      type: "list_item",
      content: [
        { type: "text", text: "Первый" },
      ],
    } as unknown as AstNode,
    {
      type: "list_item",
      content: [
        { type: "text", text: "Второй" },
      ],
    } as unknown as AstNode,
  ],
};

export const ORDERED_LIST: AstBlock = {
  id: "ol1",
  type: "list",
  attrs: { kind: "ordered" },
  content: [
    {
      type: "list_item",
      content: [{ type: "text", text: "Один" }],
    } as unknown as AstNode,
  ],
};

export const CODE_BLOCK: AstBlock = {
  id: "code1",
  type: "code_block",
  attrs: { language: "ts" },
  content: [{ type: "text", text: "const x = 1;\nconst y = 2;" }],
};

export const PARAGRAPH_WITH_LINK: AstBlock = {
  id: "p-link",
  type: "paragraph",
  content: [
    { type: "text", text: "Ссылка: " },
    {
      type: "text",
      text: "Anthropic",
      marks: [{ type: "link", attrs: { href: "https://anthropic.com" } }],
    },
  ],
};

export const PARAGRAPH_WITH_RELATIVE_LINK: AstBlock = {
  id: "p-link-rel",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "На главную",
      marks: [{ type: "link", attrs: { href: "/about" } }],
    },
  ],
};

export const PARAGRAPH_WITH_DANGEROUS_LINK: AstBlock = {
  id: "p-link-bad",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "Опасная",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    },
  ],
};

/** Валидный 64-hex storage_key — как настоящий sha256 с бека. */
export const STORAGE_KEY_FIXTURE = "deadbeef".repeat(8);

export const IMAGE_BLOCK: AstBlock = {
  id: "img1",
  type: "image",
  attrs: { storage_key: STORAGE_KEY_FIXTURE, alt: "Описание" },
  content: [],
};

export const IMAGE_BLOCK_WITH_CAPTION: AstBlock = {
  id: "img-cap",
  type: "image",
  attrs: { storage_key: STORAGE_KEY_FIXTURE, alt: "Описание", caption: "Подпись" },
  content: [],
};

export const IMAGE_BLOCK_NO_KEY: AstBlock = {
  id: "img2",
  type: "image",
  attrs: { alt: "Без storage_key" },
  content: [],
};

export const PARAGRAPH_WITH_GLOSSARY_REF: AstBlock = {
  id: "p-gref",
  type: "paragraph",
  content: [
    { type: "text", text: "См. " },
    {
      type: "text",
      text: "термин",
      marks: [{ type: "glossary_ref", attrs: { id: "term-uuid-123" } }],
    },
  ],
};

export const IMAGE_BLOCK_INVALID_KEY: AstBlock = {
  id: "img-bad",
  type: "image",
  attrs: { storage_key: "javascript:alert(1)", alt: "bad" },
  content: [],
};

export const PARAGRAPH_WITH_PROTOCOL_RELATIVE_LINK: AstBlock = {
  id: "p-link-pr",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "Phishing",
      marks: [{ type: "link", attrs: { href: "//evil.com" } }],
    },
  ],
};

export const PARAGRAPH_WITH_EMPTY_REF: AstBlock = {
  id: "p-empty-ref",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "пустой",
      marks: [{ type: "glossary_ref", attrs: { id: "" } }],
    },
  ],
};

export const PARAGRAPH_WITH_MEDIA_REF: AstBlock = {
  id: "p-mref",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "запись",
      marks: [{ type: "media_ref", attrs: { id: "med-uuid-789" } }],
    },
  ],
};

export const PARAGRAPH_WITH_COMMENT_REF: AstBlock = {
  id: "p-cref",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "реплика",
      marks: [{ type: "comment_ref", attrs: { id: "com-uuid-012" } }],
    },
  ],
};
