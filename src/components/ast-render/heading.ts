// src/components/ast-render/heading.ts
// Единый источник правды по уровню и DOM-id заголовка. Зовётся и рендерером
// (block-renderer), и оглавлением (ast-toc) → id заголовка в DOM и якорь в
// навигации гарантированно совпадают. id = backend-owned block.id (UUID,
// см. docs/domain/anchors.md); фолбэк по индексу — стопгап на редкий missing-id.
import type { AstBlock } from "./types";

export function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  const raw = (attrs as { level?: unknown } | undefined)?.level;
  if (typeof raw !== "number") return 2;
  if (raw < 1 || raw > 6) return 2;
  return raw as 1 | 2 | 3 | 4 | 5 | 6;
}

export function headingDomId(block: AstBlock, index: number): string {
  return block.id ?? `heading-${index}`;
}
