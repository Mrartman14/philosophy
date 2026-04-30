import type { AstBlock } from "../types";

export const fixtureParagraph: AstBlock = {
  id: "p1",
  type: "paragraph",
  position: 0,
  content: [{ type: "text", text: "Привет, мир." }],
  text: "Привет, мир.",
};

export const fixtureHeading: AstBlock = {
  id: "h1",
  type: "heading",
  position: 0,
  attrs: { level: 2 },
  content: [{ type: "text", text: "Заголовок" }],
  text: "Заголовок",
};

export const fixtureBlockquote: AstBlock = {
  id: "bq1",
  type: "blockquote",
  position: 0,
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Цитата." }] },
  ],
  text: "Цитата.",
};

export const fixtureCodeBlock: AstBlock = {
  id: "cb1",
  type: "code_block",
  position: 0,
  attrs: { language: "go" },
  text: "func main() {}\n",
};

export const fixtureBulletList: AstBlock = {
  id: "ul1",
  type: "list",
  position: 0,
  attrs: { ordered: false },
  content: [
    {
      type: "list_item",
      content: [{ type: "paragraph", content: [{ type: "text", text: "один" }] }],
    },
    {
      type: "list_item",
      content: [{ type: "paragraph", content: [{ type: "text", text: "два" }] }],
    },
  ],
  text: "один\nдва",
};

export const fixtureOrderedList: AstBlock = {
  id: "ol1",
  type: "list",
  position: 0,
  attrs: { ordered: true, start: 3 },
  content: [
    {
      type: "list_item",
      content: [{ type: "paragraph", content: [{ type: "text", text: "третий" }] }],
    },
  ],
  text: "третий",
};

export const fixtureTaskList: AstBlock = {
  id: "tl1",
  type: "list",
  position: 0,
  attrs: { ordered: false },
  content: [
    {
      type: "list_item",
      attrs: { checked: true },
      content: [{ type: "paragraph", content: [{ type: "text", text: "сделано" }] }],
    },
  ],
  text: "сделано",
};

export const fixtureImage: AstBlock = {
  id: "img1",
  type: "image",
  position: 0,
  attrs: {
    storage_key: "0".repeat(64),
    alt: "alt-текст",
    caption: "подпись",
  },
  text: "",
};

export const fixtureThematicBreak: AstBlock = {
  id: "hr1",
  type: "thematic_break",
  position: 0,
  text: "",
};

export const fixtureTable: AstBlock = {
  id: "tbl1",
  type: "table",
  position: 0,
  content: [
    {
      type: "table_row",
      attrs: { header: true },
      content: [
        {
          type: "table_cell",
          attrs: { align: "left" },
          content: [{ type: "text", text: "колонка" }],
        },
      ],
    },
    {
      type: "table_row",
      content: [
        {
          type: "table_cell",
          content: [{ type: "text", text: "ячейка" }],
        },
      ],
    },
  ],
  text: "колонка\nячейка",
};

export const fixtureFormattingMarks: AstBlock = {
  id: "fm1",
  type: "paragraph",
  position: 0,
  content: [
    { type: "text", marks: [{ type: "bold" }], text: "жирный" },
    { type: "text", text: " и " },
    { type: "text", marks: [{ type: "italic" }], text: "курсив" },
    { type: "text", text: " и " },
    { type: "text", marks: [{ type: "code" }], text: "код" },
  ],
  text: "жирный и курсив и код",
};

export const fixtureLink: AstBlock = {
  id: "lnk1",
  type: "paragraph",
  position: 0,
  content: [
    {
      type: "text",
      marks: [{ type: "link", attrs: { href: "https://example.com", title: "пример" } }],
      text: "ссылка",
    },
  ],
  text: "ссылка",
};

export const fixtureNavMarks: AstBlock = {
  id: "nm1",
  type: "paragraph",
  position: 0,
  content: [
    {
      type: "text",
      marks: [{ type: "lecture_ref", attrs: { id: "11111111-1111-1111-1111-111111111111" } }],
      text: "лекция",
    },
    { type: "text", text: " " },
    {
      type: "text",
      marks: [{ type: "glossary_ref", attrs: { id: "22222222-2222-2222-2222-222222222222" } }],
      text: "термин",
    },
    { type: "text", text: " " },
    {
      type: "text",
      marks: [{ type: "comment_ref", attrs: { id: "33333333-3333-3333-3333-333333333333" } }],
      text: "комментарий",
    },
  ],
  text: "лекция термин комментарий",
};

export const fixtureFullDocument: AstBlock[] = [
  fixtureHeading,
  fixtureParagraph,
  fixtureFormattingMarks,
  fixtureLink,
  fixtureNavMarks,
  fixtureBlockquote,
  fixtureCodeBlock,
  fixtureBulletList,
  fixtureOrderedList,
  fixtureTaskList,
  fixtureImage,
  fixtureThematicBreak,
  fixtureTable,
];
