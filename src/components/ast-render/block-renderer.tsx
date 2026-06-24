// src/components/ast-render/block-renderer.tsx
import type { ReactNode } from "react";

import { HOLE, NODE_MAP, type AstNodeType, type NeutralSpec } from "@/components/ast-content-map";
import { log } from "@/services/observability/client";

import { InlineRenderer } from "./inline-renderer";
import { specToReact } from "./spec-to-react";
import type { AstBlock, AstNode } from "./types";

interface Props {
  block: AstBlock;
}

// Блочные контейнеры: их content — дочерние БЛОКИ (рекурсивный BlockRenderer).
const BLOCK_CONTAINERS = new Set<AstNodeType>([
  "list",
  "list_item",
  "blockquote",
  "table",
  "table_row",
]);
// Inline-контейнеры: их content — inline-ноды (text/hard_break) → InlineRenderer.
const INLINE_CONTAINERS = new Set<AstNodeType>(["paragraph", "heading", "table_cell"]);

export function BlockRenderer({ block }: Props): ReactNode {
  const type = block.type;
  const renderer = type ? NODE_MAP[type] : undefined;
  if (!renderer) {
    // Нет записи в NODE_MAP: неизвестный/будущий block.type ИЛИ inline-тип
    // (text/hard_break), пришедший на блок-позицию. Graceful fallback + лог.
    // Полнота block-карты сторожится node-map.test.ts (единый SOT).
    const label = (block.type as string | undefined) ?? "unknown";
    log.warn(`AstRender: unsupported block type "${label}"`, { blockType: label });
    return <div data-unsupported={label} />;
  }

  let spec: NeutralSpec = renderer(block as AstNode);
  // READ-only: id заголовка (scroll-spy/TOC). Карта его не добавляет — это
  // read-атрибут поверх data-block-id. Сливаем в attrs спека до рендера.
  if (type === "heading" && typeof block.id === "string" && block.id.length > 0) {
    const [tag, attrs, ...kids] = spec;
    spec = [tag, { ...attrs, id: block.id }, ...kids];
  }

  return specToReact(spec, renderChildren(block, type));
}

function renderChildren(block: AstBlock, type: AstNodeType | undefined): ReactNode {
  // text-content: code_block → объединённый текст текст-нод (без inline-марок).
  if (type === "code_block") {
    return (block.content ?? [])
      .map((n) => (n.type === "text" ? (n.text ?? "") : ""))
      .join("");
  }
  if (type && INLINE_CONTAINERS.has(type)) {
    return <InlineRenderer nodes={block.content} />;
  }
  if (type && BLOCK_CONTAINERS.has(type)) {
    const isHeaderRow =
      type === "table_row" &&
      (block.attrs as { header?: unknown } | undefined)?.header === true;
    const children = (block.content ?? []) as unknown as AstBlock[];
    return children.map((child, i) => {
      const key = child.id ?? i;
      // READ-апгрейд: ячейки header-строки → <th scope="col"> (семантика +
      // .content th CSS). Per-node карта не знает родителя → th только в read.
      if (isHeaderRow && child.type === "table_cell") {
        return <HeaderCell key={key} cell={child} />;
      }
      return <BlockRenderer key={key} block={child} />;
    });
  }
  // Лист без HOLE (thematic_break, image): детей нет.
  return null;
}

/** table_cell в header-строке: <td> карты апгрейдится до <th scope="col">. */
function HeaderCell({ cell }: { cell: AstBlock }): ReactNode {
  const renderer = NODE_MAP.table_cell;
  if (!renderer) return null;
  const [, attrs] = renderer(cell as AstNode);
  const spec: NeutralSpec = ["th", { ...attrs, scope: "col" }, HOLE];
  return specToReact(spec, <InlineRenderer nodes={cell.content} />);
}
