import type { AstNodeType } from "./types";

// Типы AST-узлов, несущих текстовый ЛИСТ с собственным node_id (sub-block anchor).
// ЕДИНЫЙ источник истины трёх точек round-trip адресуемости якоря:
//  - serializer: пишет node.id в data-block-id/JSON,
//  - deserializer: читает node.id обратно,
//  - read-render (block-renderer): навешивает data-node-id, по которому резолвер
//    ищет лист (anchor-to-range.leafEl).
// Живёт в нейтральном ast-content-map, т.к. ast-render НЕ импортит ast-editor
// (ESLint-граница). Дрейф любой из трёх точек → тихий орфан для типа листа.
// ReadonlySet<AstNodeType> → компилятор ловит рассинхрон с schema.ts.
export const TEXT_LEAF_NODE_TYPES: ReadonlySet<AstNodeType> = new Set<AstNodeType>([
  "paragraph",
  "heading",
  "code_block",
  "table_cell",
]);
