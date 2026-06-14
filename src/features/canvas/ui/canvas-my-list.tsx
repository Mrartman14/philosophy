// src/features/canvas/ui/canvas-my-list.tsx
import Link from "next/link";

import type { CanvasSummary } from "../types";

interface Props {
  canvases: CanvasSummary[];
}

/** Read-only список карточек канвасов. */
export function CanvasMyList({ canvases }: Props) {
  if (canvases.length === 0) {
    return <p className="text-sm text-(--color-description)">Канвасов пока нет.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {canvases.flatMap((c) =>
        c.id
          ? [
              <li key={c.id} className="rounded border border-(--color-border) p-3">
                <Link href={`/canvases/${c.id}`} className="font-medium hover:text-(--color-primary)">
                  {c.title ?? "Без названия"}
                </Link>
                <span className="ml-2 text-xs text-(--color-description)">
                  {c.visibility === "public" ? "публичный" : "приватный"}
                </span>
              </li>,
            ]
          : [],
      )}
    </ul>
  );
}
