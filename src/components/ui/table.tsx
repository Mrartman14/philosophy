// src/components/ui/table.tsx
import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { cn } from "./cn";

// Облик таблицы (рамки ячеек, паддинг, заливка шапки) задаёт канонический CSS
// `.ui-table` в src/styles/content.css — общий источник истины с контентными
// (markdown/AST) таблицами. Здесь под-компоненты лишь дают семантику + проброс
// className; визуальные утилиты не дублируем, иначе пути разъезжаются.
export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  function Table({ className, ...rest }, ref) {
    return (
      <div className="w-full overflow-x-auto">
        <table ref={ref} className={cn("ui-table text-sm", className)} {...rest} />
      </div>
    );
  },
);

export const Thead = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function Thead({ className, ...rest }, ref) {
  return <thead ref={ref} className={className} {...rest} />;
});

export const Tbody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function Tbody({ className, ...rest }, ref) {
  return <tbody ref={ref} className={className} {...rest} />;
});

export const Tr = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function Tr({ className, ...rest }, ref) {
    return <tr ref={ref} className={className} {...rest} />;
  },
);

export const Th = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function Th({ className, ...rest }, ref) {
    return <th ref={ref} className={className} {...rest} />;
  },
);

export const Td = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function Td({ className, ...rest }, ref) {
    return <td ref={ref} className={className} {...rest} />;
  },
);
