// src/features/canvas/ui/canvas-containers.tsx
import { AttachmentsPanel } from "@/components/attachments";
import type { AttachmentItem } from "@/components/attachments";

import { getCanvasContainers } from "../api";

interface Props {
  canvasId: string;
  token?: string | undefined;
}

/**
 * Read-only список лекций, в которые включён канвас (reverse-lookup
 * GET /api/canvases/{id}/attachments). Имя лекции бек не отдаёт — id-плашка
 * со ссылкой на лекцию.
 */
export async function CanvasContainers({ canvasId, token }: Props) {
  const dtos = await getCanvasContainers(canvasId, token);
  const items: AttachmentItem[] = dtos.flatMap((d) =>
    d.container_id
      ? [
          {
            id: d.container_id,
            label: `Лекция ${d.container_id}`,
            sortOrder: d.sort_order ?? 0,
            href: `/lectures/${d.container_id}`,
            ...(d.entity_type ? { entityType: d.entity_type } : {}),
          },
        ]
      : [],
  );
  return (
    <AttachmentsPanel
      title="Включён в лекции"
      items={items}
      emptyText="Канвас не включён ни в одну лекцию."
    />
  );
}
