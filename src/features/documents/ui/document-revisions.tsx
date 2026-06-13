// src/features/documents/ui/document-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getDocumentRevision, getDocumentRevisions } from "../api";

interface Props {
  documentId: string;
  /** id выбранной ревизии из ?revision= страницы. */
  selectedRevisionId?: string | undefined;
}

/**
 * Server component: фетчит ревизии документа и рендерит generic RevisionHistory.
 * Показывается только для public-документов (private ревизий не имеют — гейт в
 * странице через canSeeRevisions). Бек отдаёт created_at ASC — переворачиваем.
 */
export async function DocumentRevisions({ documentId, selectedRevisionId }: Props) {
  const metas = await getDocumentRevisions(documentId);
  const selected = selectedRevisionId
    ? await getDocumentRevision(documentId, selectedRevisionId)
    : null;

  return (
    <RevisionHistory
      revisions={[...metas]
        .reverse()
        .flatMap((m) => (m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : []))}
      selectedId={selected?.id}
      buildHref={(rid) => `/documents/${documentId}?revision=${rid}`}
    >
      {selected && (
        <div className="prose max-w-none">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
