// src/components/anchor-engine/table-grid.ts
// Геометрия табличного прямоугольника: grid-индекс ячейки, сбор ячеек диапазона
// строк×столбцов по двум углам, bounding-box. Простой грид (AST-таблицы без
// colspan/rowspan). DOM-чтение, без React.

/**
 * СОБСТВЕННЫЕ строки таблицы. `querySelectorAll("tr")` — descendant-запрос и ловит
 * строки ВЛОЖЕННЫХ таблиц (table в ячейке) → загрязняет row-индекс внешней таблицы.
 * Фильтруем по «ближайшая таблица строки === эта таблица».
 */
function ownRows(table: Element): Element[] {
  return Array.from(table.querySelectorAll("tr")).filter((tr) => tr.closest("table") === table);
}

export function cellGridPos(cell: Element): { row: number; col: number } | null {
  const tr = cell.parentElement;
  if (tr?.tagName !== "TR") return null;
  const table = cell.closest("table");
  if (!table) return null;
  const col = Array.prototype.indexOf.call(tr.children, cell);
  const row = ownRows(table).indexOf(tr);
  return col < 0 || row < 0 ? null : { row, col };
}

/** Ячейки прямоугольника по двум углам. null если ячейки не в ОДНОЙ таблице. */
export function rectangleCells(startCell: Element, endCell: Element): Element[] | null {
  const table = startCell.closest("table");
  if (!table || endCell.closest("table") !== table) return null;
  const a = cellGridPos(startCell),
    b = cellGridPos(endCell);
  if (!a || !b) return null;
  const r0 = Math.min(a.row, b.row),
    r1 = Math.max(a.row, b.row);
  const c0 = Math.min(a.col, b.col),
    c1 = Math.max(a.col, b.col);
  const rows = ownRows(table);
  const out: Element[] = [];
  for (let r = r0; r <= r1; r++) {
    const tr = rows[r];
    if (!tr) continue;
    for (let c = c0; c <= c1; c++) {
      const cell = tr.children[c];
      if (cell) out.push(cell);
    }
  }
  return out;
}

export function boundingBoxOf(cells: Element[]): DOMRect | null {
  if (cells.length === 0) return null;
  let top = Infinity,
    left = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const cell of cells) {
    const r = cell.getBoundingClientRect();
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return new DOMRect(left, top, right - left, bottom - top);
}
