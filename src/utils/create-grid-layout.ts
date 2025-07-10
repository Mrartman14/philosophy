import shuffle from "lodash/shuffle";

type GridItem<T> = T & {
  id: string;
};

type PlacedGridItem<T> = GridItem<T> & {
  rowStart: number;
  columnStart: number;
  rowSpan: number;
  colSpan: number;
};

const possibleSizes: [number, number][] = [
  [2, 2],
  [2, 1],
  [1, 2],
  [1, 1],
];

export function createGridLayout<T>(
  items: GridItem<T>[],
  maxCols = 4,
  maxAttempts = 50
): PlacedGridItem<T>[] {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid: boolean[][] = [];
    const placedItems: PlacedGridItem<T>[] = [];
    const shuffledSizes = items.map(() => shuffle(possibleSizes));

    const isFree = (
      row: number,
      col: number,
      rowSpan: number,
      colSpan: number
    ): boolean => {
      for (let r = row; r < row + rowSpan; r++) {
        if (!grid[r]) grid[r] = Array(maxCols).fill(false);
        for (let c = col; c < col + colSpan; c++) {
          if (c >= maxCols || grid[r][c]) return false;
        }
      }
      return true;
    };

    const markOccupied = (
      row: number,
      col: number,
      rowSpan: number,
      colSpan: number
    ) => {
      for (let r = row; r < row + rowSpan; r++) {
        if (!grid[r]) grid[r] = Array(maxCols).fill(false);
        for (let c = col; c < col + colSpan; c++) {
          grid[r][c] = true;
        }
      }
    };

    let success = true;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sizeVariants = shuffledSizes[i];
      let placed = false;

      outer: for (let row = 0; ; row++) {
        for (let col = 0; col < maxCols; col++) {
          for (const [rowSpan, colSpan] of sizeVariants) {
            if (col + colSpan > maxCols) continue;
            if (isFree(row, col, rowSpan, colSpan)) {
              placedItems.push({
                ...item,
                rowStart: row + 1,
                columnStart: col + 1,
                rowSpan,
                colSpan,
              });
              markOccupied(row, col, rowSpan, colSpan);
              placed = true;
              break outer;
            }
          }
        }
        // Safety valve to avoid infinite loop
        if (row > items.length * 2) break;
      }

      if (!placed) {
        success = false;
        break;
      }
    }

    if (!success) continue;

    // Проверка: нижняя строка должна быть полностью заполнена
    const lastRow = grid.length - 1;
    const lastRowCells = grid[lastRow] ?? [];
    const filled = lastRowCells.filter((cell) => cell).length;
    if (filled !== maxCols) continue;

    // Проверка: нет висячих блоков
    const hasFloatingBlocks = placedItems.some((item) => {
      const endRow = item.rowStart + item.rowSpan - 1;
      return endRow > grid.length;
    });

    if (hasFloatingBlocks) continue;

    return placedItems;
  }

  throw new Error("Не удалось сгенерировать плотную сетку без дыр");
}
