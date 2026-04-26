// src/components/ui/skeleton.tsx
import { Fragment, type HTMLAttributes } from "react";
import { getRandomSumParts } from "@/utils/get-random-sum-parts";
import { cn } from "./cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Базовый плейсхолдер-блок с pulse-анимацией. Стилизуется через `className`.
 */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-(--color-text-pane)", className)}
      {...rest}
    />
  );
}

/**
 * Однострочный текстовый скелетон. Высота — одна строка текста.
 */
export function SkeletonTextLine({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-[1em] animate-pulse rounded bg-gray-300 text-base leading-7 dark:bg-gray-700",
        className,
      )}
      style={{ minHeight: "1em" }}
    />
  );
}

/**
 * Прямоугольный блок строк-скелетонов: `rows` строк по `cols` колонок,
 * каждая строка случайно разбита на отрезки разной ширины. Используется
 * для плейсхолдеров текстовых блоков с «живым» рваным краем.
 */
export function SkeletonTextBlock({
  cols = 4,
  rows = 10,
  className,
}: {
  cols?: number;
  rows?: number;
  className?: string;
}) {
  const generatedRows: number[][] = Array.from({ length: rows }, () =>
    getRandomSumParts(cols),
  );

  return (
    <div
      className={cn("grid min-h-full w-full gap-4", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, auto)`,
      }}
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
}
