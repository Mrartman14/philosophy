// src/features/canvas/ui/canvas-containers.tsx
import { AttachmentsPanel } from "@/components/attachments";
import type { AttachmentItem } from "@/components/attachments";
import { getT } from "@/i18n";

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
  const t = await getT("canvas");
  const dtos = await getCanvasContainers(canvasId, token);
  const items: AttachmentItem[] = dtos.flatMap((d) =>
    d.container_id
      ? [
          {
            id: d.container_id,
            label: t("containers.lectureLabel", { id: d.container_id }),
            sortOrder: d.sort_order ?? 0,
            href: `/lectures/${d.container_id}`,
            ...(d.entity_type ? { entityType: d.entity_type } : {}),
          },
        ]
      : [],
  );
  return (
    <AttachmentsPanel
      title={t("containers.title")}
      items={items}
      emptyText={t("containers.emptyText")}
    />
  );
}
