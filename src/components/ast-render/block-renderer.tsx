// src/components/ast-render/block-renderer.tsx
import type { ReactNode } from "react";

import { log } from "@/services/observability/client";

import { readHeadingLevel } from "./heading";
import { InlineRenderer } from "./inline-renderer";
import { ImageNode } from "./nodes/image";
import type { AstBlock, AstNode, AstRenderContext } from "./types";

interface Props {
  block: AstBlock;
  ctx: AstRenderContext;
}

export function BlockRenderer({ block, ctx }: Props): ReactNode {
  // DOM-контракт движка маргиналий (annotation-layer): каждый текст-блок несёт
  // data-block-id={block.id} как стабильный якорь для anchor-to-range /
  // anchor-from-selection. table — БЕЗ id (строки/ячейки без id → мусорный
  // якорь), image — DOM не меняем (без обёрток).
  const idAttr = block.id ? { "data-block-id": block.id } : {};
  switch (block.type) {
    case "paragraph":
      return <p {...idAttr}><InlineRenderer nodes={block.content} ctx={ctx} /></p>;
    case "heading": {
      const level = readHeadingLevel(block.attrs);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc requires the literal union for the dynamic JSX tag; ESLint mis-flags it as a no-op
      const Tag = (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
      return <Tag {...idAttr}><InlineRenderer nodes={block.content} ctx={ctx} /></Tag>;
    }
    case "list": {
      // Бэк отдаёт `attrs.ordered: boolean` (см. ast-schema/document_blocks), НЕ `kind`.
      const ordered = (block.attrs as { ordered?: unknown } | undefined)?.ordered === true;
      const Tag = ordered ? "ol" : "ul";
      const items = (block.content ?? []) as unknown as AstBlock[];
      return (
        <Tag {...idAttr}>
          {items.map((child, i) => (
            <BlockRenderer key={child.id ?? i} block={child} ctx={ctx} />
          ))}
        </Tag>
      );
    }
    case "list_item": {
      // list_item содержит БЛОЧНЫЕ ноды (paragraph, вложенный list, code_block,
      // blockquote) — не inline. Обёрточный <p> даёт паритет с редактором.
      const children = (block.content ?? []) as unknown as AstBlock[];
      return (
        <li {...idAttr}>
          {children.map((child, i) => (
            <BlockRenderer key={child.id ?? i} block={child} ctx={ctx} />
          ))}
        </li>
      );
    }
    case "code_block": {
      const lang = (block.attrs as { language?: unknown } | undefined)?.language;
      const langStr = typeof lang === "string" ? lang : undefined;
      const text = (block.content ?? [])
        .map((n) => (n.type === "text" ? n.text ?? "" : ""))
        .join("");
      return (
        // dir=ltr: код всегда LTR — иначе bidi рвёт пунктуацию/скобки в RTL-контексте.
        <pre {...idAttr} dir="ltr" data-language={langStr}>
          <code>{text}</code>
        </pre>
      );
    }
    case "blockquote": {
      // Блочный контейнер: paragraph/heading/list/code_block/вложенный blockquote.
      const children = (block.content ?? []) as unknown as AstBlock[];
      return (
        <blockquote {...idAttr}>
          {children.map((child, i) => (
            <BlockRenderer key={child.id ?? i} block={child} ctx={ctx} />
          ))}
        </blockquote>
      );
    }
    case "thematic_break":
      return <hr {...idAttr} />;
    case "table": {
      // table → table_row → table_cell → inline. `header` живёт на строке;
      // header-строка → <th scope="col"> (семантика + .content th CSS).
      // Строки/ячейки — AST-ноды без id, ключи по индексу.
      const rows = block.content ?? [];
      return (
        <table>
          <tbody>
            {rows.map((row, ri) => {
              const header = (row.attrs as { header?: unknown } | undefined)?.header === true;
              const cells = row.content ?? [];
              return (
                <tr key={ri}>
                  {cells.map((cell, ci) => {
                    const align = readCellAlign(cell.attrs);
                    const inner = <InlineRenderer nodes={cell.content} ctx={ctx} />;
                    return header ? (
                      <th key={ci} scope="col" data-align={align}>{inner}</th>
                    ) : (
                      <td key={ci} data-align={align}>{inner}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
    case "image":
      return <ImageNode attrs={block.attrs} />;
    default: {
      // @ts-expect-error — drift-detector: при добавлении нового block.type в схему,
      // TS-компилятор подсветит эту строку (нет ts-error → switch неполный).
      const _exhaustive: never = block.type;
      log.warn(`AstRender: unsupported block type "${String(_exhaustive)}"`, {
        blockType: String(_exhaustive),
      });
      return (
        <div {...idAttr} data-unsupported={block.type ?? "unknown"}>
          <InlineRenderer nodes={block.content} ctx={ctx} />
        </div>
      );
    }
  }
}

function readCellAlign(attrs: AstNode["attrs"]): "left" | "center" | "right" | undefined {
  const raw = (attrs as { align?: unknown } | undefined)?.align;
  return raw === "left" || raw === "center" || raw === "right" ? raw : undefined;
}
