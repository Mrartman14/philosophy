// src/components/ast-render/heading.ts
// Тонкая обёртка над общим клампом уровня заголовка (clampHeadingLevel живёт в
// ast-content-map — единый источник правды). Рендерер выбирает тег <h1..6> через
// карту (headingTag → clampHeadingLevel), а readHeadingLevel потребляет только
// оглавление (ast-toc/extract-headings). DOM-id заголовка = backend-owned
// block.id (UUID, см. docs/domain/anchors.md) — фолбэка по индексу нет:
// он мог коллидировать с id топ-левел заголовка (дубль DOM id → битый якорь).
import { clampHeadingLevel } from "@/components/ast-content-map";

import type { AstBlock } from "./types";

export function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  return clampHeadingLevel((attrs as { level?: unknown } | undefined)?.level);
}
