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

// DOM-контракт движка маргиналий (annotation-layer): каждый текст-блок несёт
// data-block-id={block.id}, чтобы anchor-to-range/anchor-from-selection могли
// надёжно querySelector('[data-block-id]') внутри AST-рута. table — БЕЗ id
// (строки/ячейки без id → мусорный якорь), image — DOM не меняется.
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

  it("list_item несёт data-block-id", () => {
    expect(
      markupFor({
        id: "ul1",
        type: "list",
        attrs: { ordered: false },
        content: [
          {
            id: "li1",
            type: "list_item",
            content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
          },
        ],
      } as unknown as AstBlock),
    ).toContain('data-block-id="li1"');
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

  it("blockquote и его вложенный paragraph несут собственные data-block-id", () => {
    const blockquote = {
      id: "bq",
      type: "blockquote",
      content: [
        { id: "p2", type: "paragraph", content: [{ type: "text", text: "x" }] },
      ],
    } as unknown as AstBlock;
    expect(markupFor(blockquote)).toContain('data-block-id="bq"');
    expect(markupFor(blockquote)).toContain('data-block-id="p2"');
  });

  it("thematic_break несёт data-block-id", () => {
    expect(markupFor({ id: "hr1", type: "thematic_break", content: [] })).toContain(
      'data-block-id="hr1"',
    );
  });

  it("table — БЕЗ data-block-id (строки/ячейки без id → мусорный якорь)", () => {
    expect(
      markupFor({
        id: "t1",
        type: "table",
        content: [
          {
            type: "table_row",
            content: [{ type: "table_cell", content: [{ type: "text", text: "c" }] }],
          },
        ],
      } as unknown as AstBlock),
    ).not.toContain("data-block-id");
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
