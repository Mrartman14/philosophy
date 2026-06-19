// src/features/canvas/ui/canvas-my-list.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { CanvasSummary } from "../types";

interface Props {
  canvases: CanvasSummary[];
}

/** Read-only список карточек канвасов. */
export async function CanvasMyList({ canvases }: Props) {
  const t = await getT("canvas");

  if (canvases.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("myList.empty")}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {canvases.flatMap((c) =>
        c.id
          ? [
              <li key={c.id} className="rounded border border-(--color-border) p-3">
                <RouterLink href={`/canvases/${c.id}`} className="font-medium hover:text-(--color-accent)">
                  {c.title ?? t("myList.untitled")}
                </RouterLink>
                <span className="ml-2 text-xs text-(--color-fg-muted)">
                  {c.visibility === "public" ? t("myList.visibilityPublic") : t("myList.visibilityPrivate")}
                </span>
              </li>,
            ]
          : [],
      )}
    </ul>
  );
}
