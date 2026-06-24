// src/components/ast-toc/extract-headings.ts
// Чистое извлечение оглавления из AST. Агностично к роду сущности — на входе
// только AstBlock[]. Сериализуемый результат уходит в клиентский <AstToc>.
import { readHeadingLevel, type AstBlock, type AstNode } from "@/components/ast-render";

export interface HeadingEntry {
  id: string;
  level: number;
  text: string;
}

/** Рекурсивно собирает текст inline-нод (фолбэк, когда block.text не задан). */
function inlineText(nodes: AstNode[] | undefined): string {
  if (!nodes) return "";
  let out = "";
  for (const n of nodes) {
    if (typeof n.text === "string") out += n.text;
    if (n.content) out += inlineText(n.content);
  }
  return out;
}

/**
 * Возвращает заголовки top-level блоков в порядке документа. id заголовка =
 * backend-owned block.id (тот же, что ставит BlockRenderer). Заголовки без
 * block.id пропускаются: без стабильного DOM-id якорь оглавления некуда вести.
 */
export function extractHeadings(blocks: AstBlock[]): HeadingEntry[] {
  const out: HeadingEntry[] = [];
  blocks.forEach((block) => {
    if (block.type !== "heading" || !block.id) return;
    out.push({
      id: block.id,
      level: readHeadingLevel(block.attrs),
      text: typeof block.text === "string" && block.text.length > 0
        ? block.text
        : inlineText(block.content),
    });
  });
  return out;
}
