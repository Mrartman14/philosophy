// src/components/ui/table.tsx
import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { cn } from "./cn";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  function Table({ className, ...rest }, ref) {
    return (
      <div className="w-full overflow-x-auto">
        <table
          ref={ref}
          className={cn("w-full border-collapse text-sm", className)}
          {...rest}
        />
      </div>
    );
  },
);

export const Thead = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function Thead({ className, ...rest }, ref) {
  return (
    <thead
      ref={ref}
      className={cn("border-b border-(--color-border) text-start", className)}
      {...rest}
    />
  );
});

export const Tbody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function Tbody({ className, ...rest }, ref) {
  return <tbody ref={ref} className={className} {...rest} />;
});

export const Tr = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function Tr({ className, ...rest }, ref) {
    return (
      <tr
        ref={ref}
        className={cn("border-b border-(--color-border) last:border-b-0", className)}
        {...rest}
      />
    );
  },
);

export const Th = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function Th({ className, ...rest }, ref) {
    return (
      <th
        ref={ref}
        className={cn("px-3 py-2 font-semibold text-(--color-fg-muted)", className)}
        {...rest}
      />
    );
  },
);

export const Td = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function Td({ className, ...rest }, ref) {
    return <td ref={ref} className={cn("px-3 py-2", className)} {...rest} />;
  },
);
