// src/features/forms/ui/blocks-text.ts
import type { AstBlock } from "../types";

/**
 * Грубое извлечение текста из AST-блоков для предзаполнения markdown-полей
 * при редактировании. Не обратное преобразование в markdown (бек хранит блоки,
 * не исходник) — только plain-текст параграфов через перевод строки. Достаточно
 * для текстовых описаний; форматирование при редактировании будет потеряно
 * (известное ограничение — см. риски плана).
 */
export function blocksToPlainText(blocks: AstBlock[]): string {
  return blocks
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .filter((t) => t.length > 0)
    .join("\n\n");
}
