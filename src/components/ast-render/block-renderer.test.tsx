// src/components/ast-render/block-renderer.test.tsx
import { render, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, afterEach } from "vitest";

import { BlockRenderer } from "./block-renderer";
import type { AstBlock } from "./types";

vi.mock("@/services/observability/client", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

describe("BlockRenderer наблюдаемость", () => {
  it("логирует неизвестный тип блока через log.warn, а не console", async () => {
    const { log } = await import("@/services/observability/client");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );
    // @ts-expect-error — намеренно невалидный тип блока для ветки default
    render(<BlockRenderer block={{ type: "__unknown__" }} />);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("unsupported block type"),
      expect.objectContaining({ blockType: "__unknown__" }),
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// DOM-контракт движка маргиналий (anchor-engine): block-блоки несут
// data-block-id={block.id} как scope-хинт для anchor-to-range/anchor-from-selection
// (querySelector('[data-block-id]') внутри AST-рута). НЕ несут: table, image и
// вложенные ast.Node (list_item, строки/ячейки) — у них нет id; текст внутри
// якорится к объемлющему block-блоку (list/table) + exact/prefix/suffix (anchors.md).
// renderToStaticMarkup (а не RTL render): проверяем строковый HTML на атрибут.
const markupFor = (b: AstBlock): string =>
  renderToStaticMarkup(<BlockRenderer block={b} />);

describe("BlockRenderer — data-block-id (DOM-контракт движка)", () => {
  it("paragraph несёт data-block-id", () => {
    expect(
      markupFor({ id: "p1", type: "paragraph", content: [{ type: "text", text: "x" }] }),
    ).toContain('data-block-id="p1"');
  });

  it("heading несёт data-block-id", () => {
    expect(
      markupFor({
        id: "h1",
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "x" }],
      }),
    ).toContain('data-block-id="h1"');
  });

  it("list (ul) несёт data-block-id", () => {
    expect(
      markupFor({
        id: "ul1",
        type: "list",
        attrs: { ordered: false },
        content: [
          {
            type: "list_item",
            content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
          },
        ],
      } as unknown as AstBlock),
    ).toContain('data-block-id="ul1"');
  });

  it("list_item НЕ несёт data-block-id (текст в списке якорится через list-блок)", () => {
    const listBlock = {
      id: "ul1",
      type: "list",
      attrs: { ordered: false },
      content: [
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
        },
      ],
    } as unknown as AstBlock;
    // <ul> несёт data-block-id (scope-хинт), <li> — нет.
    expect(markupFor(listBlock)).toContain('data-block-id="ul1"');
    expect(markupFor(listBlock)).not.toMatch(/<li[^>]*data-block-id/);
  });

  it("code_block несёт data-block-id", () => {
    expect(
      markupFor({
        id: "code1",
        type: "code_block",
        attrs: { language: "ts" },
        content: [{ type: "text", text: "const x = 1;" }],
      }),
    ).toContain('data-block-id="code1"');
  });

  it("blockquote несёт data-block-id; вложенный paragraph — data-node-id, НЕ data-block-id", () => {
    const blockquote = {
      id: "bq",
      type: "blockquote",
      content: [
        { id: "p2", type: "paragraph", content: [{ type: "text", text: "q" }] },
      ],
    } as unknown as AstBlock;
    expect(markupFor(blockquote)).toContain('data-block-id="bq"');
    // Вложенный лист несёт ТОЛЬКО data-node-id: block_id только у top-level, иначе
    // closest('[data-block-id]') зарезолвит в лист вместо объемлющего блока.
    expect(markupFor(blockquote)).toContain('data-node-id="p2"');
    expect(markupFor(blockquote)).not.toMatch(/<p[^>]*data-block-id="p2"/);
  });

  it("thematic_break несёт data-block-id", () => {
    expect(markupFor({ id: "hr1", type: "thematic_break", content: [] })).toContain(
      'data-block-id="hr1"',
    );
  });

  it("table несёт data-block-id, ячейка — data-node-id (read)", () => {
    const table = {
      id: "tbl-1",
      type: "table",
      content: [
        {
          type: "table_row",
          content: [
            { type: "table_cell", id: "cell-1", content: [{ type: "text", text: "x" }] },
          ],
        },
      ],
    } as unknown as AstBlock;
    // table — единственный top-block, которому block-id добавляет BlockRenderer
    // (карта его опускает). Ячейка — вложенный лист → data-node-id.
    expect(markupFor(table)).toContain('data-block-id="tbl-1"');
    expect(markupFor(table)).toContain('data-node-id="cell-1"');
  });

  it("top-level paragraph несёт оба атрибута с одним id", () => {
    const paragraph: AstBlock = {
      id: "p-1",
      type: "paragraph",
      content: [{ type: "text", text: "hi" }],
    };
    expect(markupFor(paragraph)).toContain('data-block-id="p-1"');
    expect(markupFor(paragraph)).toContain('data-node-id="p-1"');
  });

  it("image — DOM не меняется (нет data-block-id на figure)", () => {
    expect(
      markupFor({
        id: "img1",
        type: "image",
        attrs: { storage_key: "deadbeef".repeat(8), alt: "alt" },
        content: [],
      }),
    ).not.toContain("data-block-id");
  });

  it("блок без id — без атрибута", () => {
    expect(
      markupFor({ type: "paragraph", content: [{ type: "text", text: "x" }] }),
    ).not.toContain("data-block-id");
  });
});

// READ-рендер чек-листа (опубликованный документ). Чекбоксы СТАТИЧНЫ (disabled):
// состояние — часть контента, меняется только в редакторе. Семантический <input>
// (а не CSS-псевдоэлемент) — ради a11y, как у GitHub.
describe("BlockRenderer — чек-лист (read, статичные disabled-чекбоксы)", () => {
  const taskList = (checked: boolean): AstBlock =>
    ({
      id: "tl",
      type: "list",
      attrs: { ordered: false },
      content: [
        {
          type: "list_item",
          attrs: { checked },
          content: [{ type: "paragraph", content: [{ type: "text", text: "пункт" }] }],
        },
      ],
    }) as unknown as AstBlock;

  it("задача checked=true → отмеченный disabled-чекбокс + data-checked", () => {
    const block = taskList(true);
    expect(markupFor(block)).toMatch(/<input[^>]*type="checkbox"/);
    expect(markupFor(block)).toMatch(/<input[^>]*checked/);
    expect(markupFor(block)).toMatch(/<input[^>]*disabled/);
    expect(markupFor(block)).toContain('data-checked="true"');
  });

  it("задача checked=false → снятый disabled-чекбокс", () => {
    const block = taskList(false);
    expect(markupFor(block)).toMatch(/<input[^>]*type="checkbox"/);
    expect(markupFor(block)).toMatch(/<input[^>]*disabled/);
    expect(markupFor(block)).not.toMatch(/<input[^>]*checked/);
    expect(markupFor(block)).toContain('data-checked="false"');
  });

  it("обычный пункт (без checked) → без чекбокса", () => {
    const block = {
      id: "ul",
      type: "list",
      attrs: { ordered: false },
      content: [
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [{ type: "text", text: "пункт" }] }],
        },
      ],
    } as unknown as AstBlock;
    expect(markupFor(block)).not.toContain("checkbox");
    expect(markupFor(block)).not.toContain("data-checked");
  });
});
