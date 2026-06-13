// src/features/annotations/ui/annotation-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getAnnotationRevision, getAnnotationRevisions } from "../api";

interface Props {
  annotationId: string;
  /** id выбранной ревизии (?revision= из searchParams страницы). */
  selectedRevisionId?: string | undefined;
  /** База для buildHref (например /me/annotations/{id}). */
  basePath: string;
}

/**
 * Server-компонент ревизий аннотации. Бек отдаёт ASC (старые первыми) —
 * переворачиваем (паттерн events). Ревизии есть только у public-аннотаций
 * (бек снапшотит лишь public при Update) — для private список будет пуст.
 */
export async function AnnotationRevisions({
  annotationId,
  selectedRevisionId,
  basePath,
}: Props) {
  const metas = await getAnnotationRevisions(annotationId);
  const selected = selectedRevisionId
    ? await getAnnotationRevision(annotationId, selectedRevisionId)
    : null;

  return (
    <RevisionHistory
      revisions={[...metas]
        .reverse()
        .flatMap((m) =>
          m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : [],
        )}
      selectedId={selected?.id}
      buildHref={(rid) => `${basePath}?revision=${rid}`}
    >
      {selected && (
        <div className="prose prose-sm">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
