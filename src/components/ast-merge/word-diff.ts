import type { AstBlock } from "@/components/ast-editor";
// Deep type-only импорт: `AstNode` не реэкспортится баррелем редактора, а тянуть
// весь tiptap-баррель ради типа не нужно (см. ту же мотивацию в ast-merge-view).
import type { AstNode } from "@/components/ast-editor/types";

import type { DiffToken } from "./types";

/** Типы узлов, чьи дети — блочного уровня: их склеиваем переносом строки, чтобы
 *  diff списков/таблиц/цитат не схлопывался в «суп» без разделителей. */
const STRUCTURAL: ReadonlySet<string> = new Set([
  "list",
  "list_item",
  "table",
  "table_row",
  "blockquote",
]);

/** Рекурсивная склейка содержимого узла в строку для DISPLAY пословного diff.
 *  Структурные дети (`list`/`table`/…) разделяются `"\n"`, инлайновые (текстовые
 *  узлы параграфа/заголовка) — пустой строкой (слова не дробятся). */
function nodeDiffText(node: AstNode): string {
  const children = node.content;
  if (!children || children.length === 0) return node.text ?? "";
  const sep = STRUCTURAL.has(node.type ?? "") ? "\n" : "";
  return children.map(nodeDiffText).join(sep);
}

/** Текст блока для пословного diff с разделителями между блочными детьми.
 *  Классификация при этом не затрагивается — она сравнивает нормализованный JSON;
 *  это сугубо про читаемость отображаемого diff. Чистая.
 *
 *  - Обычный параграф → ровно его плоский текст (поведение как у `block.text`).
 *  - Список из двух пунктов → `"item1\nitem2"` вместо «item1item2».
 *  - Лист/code_block без `content` → `block.text ?? ""` (контентный fallback). */
export function blockDiffText(block: AstBlock): string {
  const children = block.content;
  if (!children || children.length === 0) return block.text ?? "";
  const sep = STRUCTURAL.has(block.type ?? "") ? "\n" : "";
  return children.map(nodeDiffText).join(sep);
}

/** Делит строку на токены-слова и токены-пробелы, чтобы склейка была без потерь. */
function tokenize(s: string): string[] {
  return s.match(/\s+|\S+/g) ?? [];
}

/** Пословный diff на основе LCS. O(n*m) — приемлемо для текста одного блока. */
export function wordDiff(baseText: string, sideText: string): DiffToken[] {
  const a = tokenize(baseText);
  const b = tokenize(sideText);
  const n = a.length;
  const m = b.length;

  // dp[i][j] = длина LCS суффиксов a[i:] и b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i] ?? [];
    for (let j = m - 1; j >= 0; j--) {
      row[j] =
        a[i] === b[j]
          ? (dp[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] ?? "" });
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      out.push({ type: "del", text: a[i] ?? "" });
      i++;
    } else {
      out.push({ type: "add", text: b[j] ?? "" });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] ?? "" });
  while (j < m) out.push({ type: "add", text: b[j++] ?? "" });
  return out;
}
