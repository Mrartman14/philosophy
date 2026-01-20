"use client";


import { createGridLayout } from "@/utils/create-grid-layout";
import "./compact-grid.css";

type CompactGridProps<T> = {
  data: T[];
  containerClassName?: string;
  renderItem: (item: T, i: number) => React.ReactNode;
};
// TODO: not used
export const CompactGrid = <T extends { id: string }>({
  data,
  containerClassName,
  renderItem,
}: CompactGridProps<T>) => {
  const gridItems = createGridLayout(data, 4);

  return (
    <div
      className={`w-full p-4 grid gap-4 grid-cols-1 md:grid-cols-4 ${containerClassName}`}
    >
      {gridItems.map((item, i) => {
        return (
          <div
            key={item.id}
            style={
              {
                "--col-start": item.columnStart,
                "--row-start": item.rowStart,
                "--col-span": item.colSpan,
                "--row-span": item.rowSpan,
              } as React.CSSProperties
            }
            className={`compact-grid-item`}
          >
            {renderItem(item, i)}
          </div>
        );
      })}
    </div>
  );
};
