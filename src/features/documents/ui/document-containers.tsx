// src/features/documents/ui/document-containers.tsx
import { AttachmentsPanel } from "@/components/attachments";
import type { AttachmentItem } from "@/components/attachments";
import { getT } from "@/i18n";

import { getDocumentContainers } from "../api";

interface Props {
  documentId: string;
}

/**
 * Read-only список лекций, в которые включён документ (reverse-lookup
 * GET /api/documents/{id}/attachments). Управление attach/detach/reorder — на
 * странице лекции (lecture-enrichment, волна 3); здесь только просмотр
 * (canManage не передаём). Имя лекции бек в DTO не отдаёт — показываем id-плашку
 * со ссылкой на лекцию.
 */
export async function DocumentContainers({ documentId }: Props) {
  const t = await getT("documents");
  const dtos = await getDocumentContainers(documentId);
  const items: AttachmentItem[] = dtos.flatMap((d) =>
    d.container_id
      ? [
          {
            id: d.container_id,
            label: t("containerLinkLabel", { id: d.container_id }),
            sortOrder: d.sort_order ?? 0,
            href: `/lectures/${d.container_id}`,
            ...(d.entity_type ? { entityType: d.entity_type } : {}),
          },
        ]
      : [],
  );

  return (
    <AttachmentsPanel
      title={t("containersPanelTitle")}
      items={items}
      emptyText={t("containersEmpty")}
    />
  );
}
