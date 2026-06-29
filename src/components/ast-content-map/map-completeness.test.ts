import { describe, it, expect } from "vitest";

import { NODE_MAP, MARK_MAP } from "@/components/ast-content-map";
import type { AstNodeType, AstMarkType } from "@/components/ast-content-map";

/**
 * Сторож дрейфа карт node→DOM. Раньше эту роль играл `const _exhaustive: never`
 * в switch старого рендера: добавление нового AstNodeType в schema.ts ломало
 * компиляцию. Рендер переписан на NODE_MAP/MARK_MAP — switch-сторож исчез.
 *
 * Здесь он восстановлен на уровне типов: NODE_KIND и MARK_ALL — ИСЧЕРПЫВАЮЩИЕ
 * `Record<…Type, …>`. Реген schema.ts, добавивший член union, СЛОМАЕТ КОМПИЛЯЦИЮ
 * этого файла, пока новый тип не классифицируют (block/inline) и (для марок)
 * не добавят в карту. Рантайм-ассерты ниже ловят пропуск записи в самой карте.
 */

// Исчерпывающая классификация КАЖДОГО узла: block (рендерится через NODE_MAP)
// или inline (text/hard_break — их обслуживает InlineRenderer, НЕ NODE_MAP).
// Пропусти член union → TS-ошибка "Property … is missing".
const NODE_KIND: Record<AstNodeType, "block" | "inline"> = {
  paragraph: "block",
  heading: "block",
  blockquote: "block",
  code_block: "block",
  list: "block",
  list_item: "block",
  image: "block",
  table: "block",
  table_row: "block",
  table_cell: "block",
  thematic_break: "block",
  text: "inline",
  hard_break: "inline",
};

// Исчерпывающее перечисление КАЖДОЙ марки. Пропусти член union → TS-ошибка.
const MARK_ALL: Record<AstMarkType, true> = {
  bold: true,
  italic: true,
  code: true,
  strike: true,
  link: true,
  glossary_ref: true,
  document_ref: true,
  media_ref: true,
  comment_ref: true,
  canvas_ref: true,
};

const nodeTypes = Object.keys(NODE_KIND) as AstNodeType[];
const blockTypes = nodeTypes.filter((t) => NODE_KIND[t] === "block");
const inlineTypes = nodeTypes.filter((t) => NODE_KIND[t] === "inline");
const markTypes = Object.keys(MARK_ALL) as AstMarkType[];

describe("полнота NODE_MAP / MARK_MAP (сторож дрейфа schema.ts)", () => {
  it.each(blockTypes)("NODE_MAP покрывает block-узел %s", (type) => {
    expect(NODE_MAP[type]).toBeTypeOf("function");
  });

  it.each(inlineTypes)("inline-узел %s обслуживается InlineRenderer, а не NODE_MAP", (type) => {
    // text/hard_break не должны попасть в NODE_MAP — их рендерит InlineRenderer.
    expect(NODE_MAP[type]).toBeUndefined();
  });

  it.each(markTypes)("MARK_MAP покрывает марку %s", (type) => {
    expect(MARK_MAP[type]).toBeTypeOf("function");
  });

  it("в NODE_MAP нет лишних/inline-ключей сверх block-классификации", () => {
    const mapped = Object.keys(NODE_MAP) as AstNodeType[];
    expect([...mapped].sort()).toEqual([...blockTypes].sort());
  });

  it("в MARK_MAP нет лишних ключей сверх AstMarkType", () => {
    const mapped = Object.keys(MARK_MAP) as AstMarkType[];
    expect([...mapped].sort()).toEqual([...markTypes].sort());
  });
});
