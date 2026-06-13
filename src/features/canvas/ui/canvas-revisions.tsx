// src/features/canvas/ui/canvas-revisions.tsx
import { RevisionHistory } from "@/components/revision-history";
import { getCanvasRevision, getCanvasRevisions } from "../api";
import { CanvasDetail } from "./canvas-detail";

interface Props {
  canvasId: string;
  /** Выбранный rev_num из ?revision= (строка). */
  selectedRevision?: string | undefined;
  token?: string | undefined;
}

/**
 * Ревизии канваса. RevisionMeta не имеет id — ключ это rev_num (int); мапим
 * его в строковый id для generic RevisionHistory. Бек отдаёт created_at ASC —
 * переворачиваем. Снапшот рендерим тем же canvas-render через CanvasDetail.
 */
export async function CanvasRevisions({ canvasId, selectedRevision, token }: Props) {
  const metas = await getCanvasRevisions(canvasId, token);
  const revNum = selectedRevision ? Number(selectedRevision) : NaN;
  const selected = Number.isInteger(revNum) && revNum >= 1
    ? await getCanvasRevision(canvasId, revNum, token)
    : null;

  return (
    <RevisionHistory
      revisions={[...metas]
        .reverse()
        .flatMap((m) =>
          m.rev_num != null
            ? [{ id: String(m.rev_num), createdAt: m.created_at ?? "", label: `Версия ${m.rev_num}` }]
            : [],
        )}
      selectedId={selected?.rev_num != null ? String(selected.rev_num) : undefined}
      buildHref={(rid) => `/canvases/${canvasId}?revision=${rid}`}
    >
      {selected && <CanvasDetail data={selected.data} />}
    </RevisionHistory>
  );
}
