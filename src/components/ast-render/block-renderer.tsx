// src/components/ast-render/block-renderer.tsx
import type { ReactNode } from "react";

import {
  HOLE,
  NODE_MAP,
  TEXT_LEAF_NODE_TYPES,
  type AstNodeType,
  type NeutralSpec,
} from "@/components/ast-content-map";
import { log } from "@/services/observability/client";

import { InlineRenderer } from "./inline-renderer";
import { specToReact } from "./spec-to-react";
import type { AstBlock, AstNode } from "./types";

interface Props {
  block: AstBlock;
  isTopLevel?: boolean;
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

/**
 * Depth-aware identity поверх карты:
 *  - вложенный узел: СНЯТЬ data-block-id (block_id — только top-level; иначе
 *    closest('[data-block-id]') зарезолвит в лист вместо объемлющего блока);
 *  - table (top-level): ДОБАВИТЬ data-block-id (карта его опускает);
 *  - текст-лист (top И nested): ДОБАВИТЬ data-node-id.
 * image/thematic_break не трогаем — их block-id-контракт остаётся как в карте.
 */
function applyIdentity(
  baseAttrs: Record<string, string>,
  block: AstBlock,
  isTopLevel: boolean,
): Record<string, string> {
  const id = typeof block.id === "string" && block.id.length > 0 ? block.id : null;
  const attrs: Record<string, string> = { ...baseAttrs };
  if (!isTopLevel) {
    delete attrs["data-block-id"]; // вложенный никогда не несёт block_id
  } else if (block.type === "table" && id) {
    attrs["data-block-id"] = id; // table: карта block-id опускает
  }
  if (id && block.type && TEXT_LEAF_NODE_TYPES.has(block.type)) {
    attrs["data-node-id"] = id;
  }
  return attrs;
}

export function BlockRenderer({ block, isTopLevel = true }: Props): ReactNode {
  const type = block.type;
  const renderer = type ? NODE_MAP[type] : undefined;
  if (!renderer) {
    // Нет записи в NODE_MAP: неизвестный/будущий block.type ИЛИ inline-тип
    // (text/hard_break), пришедший на блок-позицию. Graceful fallback + лог.
    // Полнота block-карты сторожится map-completeness.test.ts (единый SOT):
    // исчерпывающий Record<AstNodeType> ломает компиляцию при дрейфе schema.ts.
    const label = (block.type as string | undefined) ?? "unknown";
    log.warn(`AstRender: unsupported block type "${label}"`, { blockType: label });
    return <div data-unsupported={label} />;
  }

  const [tag, baseAttrs, ...kids] = renderer(block as AstNode);
  let attrs = applyIdentity(baseAttrs, block, isTopLevel);
  // READ-only: id заголовка (scroll-spy/TOC). Карта его не добавляет — это
  // read-атрибут поверх data-block-id. Сливаем в attrs спека до рендера
  // (системный block.id, НЕ attrs.id).
  if (type === "heading" && typeof block.id === "string" && block.id.length > 0) {
    attrs = { ...attrs, id: block.id };
  }
  const spec: NeutralSpec = [tag, attrs, ...kids];
  return specToReact(spec, renderChildren(block, type));
}

function renderChildren(block: AstBlock, type: AstNodeType | undefined): ReactNode {
  // text-content: code_block → текст кода. Канонически он в block.text
  // (ast-editor/serializer: "code_block stores text on Block.Text, no Content").
  // Фолбэк на объединённый текст content-нод — совместимость со старой формой.
  if (type === "code_block") {
    if (typeof block.text === "string") return block.text;
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
      return <BlockRenderer key={key} block={child} isTopLevel={false} />;
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
  // Ячейка — вложенный лист: applyIdentity навешивает data-node-id, block-id нет.
  const spec: NeutralSpec = ["th", { ...applyIdentity(attrs, cell, false), scope: "col" }, HOLE];
  return specToReact(spec, <InlineRenderer nodes={cell.content} />);
}
