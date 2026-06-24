// src/components/ast-render/heading.ts
// Единый источник правды по уровню заголовка. Зовётся и рендерером
// (block-renderer), и оглавлением (ast-toc). DOM-id заголовка = backend-owned
// block.id (UUID, см. docs/domain/anchors.md) — фолбэка по индексу нет:
// он мог коллидировать с id топ-левел заголовка (дубль DOM id → битый якорь).
import type { AstBlock } from "./types";

export function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  const raw = (attrs as { level?: unknown } | undefined)?.level;
  if (typeof raw !== "number") return 2;
  if (raw < 1 || raw > 6) return 2;
  return raw as 1 | 2 | 3 | 4 | 5 | 6;
}
