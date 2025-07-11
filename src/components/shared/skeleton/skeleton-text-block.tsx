import { Fragment } from "react";

import { getRandomSumParts } from "@/utils/get-random-sum-parts";
import { SkeletonTextLine } from "@/components/shared/skeleton/skeleton-text-line";

export const SkeletonTextBlock: React.FC<{
  cols?: number;
  rows?: number;
  className?: string;
}> = ({ cols = 4, rows = 10, className }) => {
  const generatedRows: number[][] = [...new Array(rows)].map(() =>
    getRandomSumParts(cols)
  );

  return (
    <div
      className={`prose md:prose-xl grid grid-cols-${cols} gap-4 w-full min-h-full ${
        className ?? ""
      }`}
      style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}
    >
      {generatedRows.map((row, rowIndex) => (
        <Fragment key={rowIndex}>
          {row.map((col, colIndex) => (
            <SkeletonTextLine
              key={`${rowIndex}-${colIndex}`}
              className={`col-span-${col}`}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
};
