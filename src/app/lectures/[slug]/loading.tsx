import { getRandomSumParts } from "@/utils/get-random-sum-parts";
import { Fragment } from "react";

const Loading: React.FC = () => {
  const totalCols = 4;
  const rows: number[][] = [...new Array(10)].map(() =>
    getRandomSumParts(totalCols)
  );

  return (
    <div
      className={`prose grid grid-cols-${totalCols} gap-4 w-[65ch] min-h-full`}
      style={{ gridTemplateColumns: `repeat(${totalCols},1fr)` }}
    >
      <SkeletonTextLine className={`col-span-12 h-[70vh] rounded-3xl`} />
      {rows.map((row, rowIndex) => (
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
export default Loading;

function SkeletonTextLine({ className = "" }) {
  return (
    <div
      className={`bg-gray-300 dark:bg-gray-700 rounded animate-pulse 
          text-base leading-7 h-[1em] ${className}`}
      style={{ minHeight: "1em" }}
    />
  );
}
