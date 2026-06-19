// src/components/ui/empty-state.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Плейсхолдер для пустых списков/коллекций: заголовок, опциональное
 * описание и опциональное действие (например, кнопка «Создать»).
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded border border-dashed border-(--color-border) p-8 text-center",
        className,
      )}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {description !== undefined && (
        <p className="max-w-sm text-xs text-(--color-fg-muted)">{description}</p>
      )}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
