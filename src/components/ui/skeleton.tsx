// src/components/ui/skeleton.tsx
import { type HTMLAttributes } from "react";
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
