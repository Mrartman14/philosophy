// src/features/lectures/ui/lecture-canvas-list.tsx
import { RouterLink } from "@/components/ui";

import { orderLectureCanvases } from "../order-canvases";
import type { LectureCanvasItem } from "../types";

interface Props {
  canvases: LectureCanvasItem[];
  token?: string | undefined;
  heading: string;
  entryBadge: string;
  untitledLabel: string;
}

/**
 * Секция канвасов лекции: ссылки на /canvases/{id}. Лёгкий листинг
 * (GET /api/lectures/{id}/canvases) не несёт data графа — сам канвас рендерится
 * на своей странице, поэтому здесь только навигация. Основной канвас (is_entry)
 * первым, с бейджем. token (?token=) пробрасывается для приватных лекций
 * (share-link). Пустой список → секция не рендерится.
 */
export function LectureCanvasList({
  canvases,
  token,
  heading,
  entryBadge,
  untitledLabel,
}: Props) {
  const ordered = orderLectureCanvases(canvases);
  if (ordered.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={heading}>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <ul className="flex flex-col gap-2">
        {ordered.map((c) => {
          const href = token
            ? `/canvases/${c.id}?token=${encodeURIComponent(token)}`
            : `/canvases/${c.id}`;
          // Пустая/пробельная title → фолбэк-лейбл (проверка по длине, не ??).
          const trimmed = c.title?.trim() ?? "";
          return (
            <li key={c.id} className="flex items-center gap-2">
              <RouterLink href={href} className="text-(--color-link) hover:underline">
                {trimmed.length > 0 ? trimmed : untitledLabel}
              </RouterLink>
              {c.is_entry && (
                <span className="rounded bg-(--color-surface-subtle) px-1.5 py-0.5 text-xs text-(--color-fg-muted)">
                  {entryBadge}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
