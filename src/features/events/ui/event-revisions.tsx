// src/features/events/ui/event-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getEventRevision, getEventRevisions } from "../api";

interface Props {
  eventId: string;
  /** id выбранной ревизии из searchParams страницы (?revision=). */
  selectedRevisionId?: string | undefined;
}

/**
 * Server component: фетчит ревизии события через api.ts слайса и рендерит
 * generic RevisionHistory. Контент выбранной ревизии — AstRender по снапшоту.
 * editor_id бекенда — UUID без username, в label не показываем.
 */
export async function EventRevisions({ eventId, selectedRevisionId }: Props) {
  const metas = await getEventRevisions(eventId);
  const selected = selectedRevisionId
    ? await getEventRevision(eventId, selectedRevisionId)
    : null;

  return (
    <RevisionHistory
      // Бек отдаёт ревизии в порядке created_at ASC (старые первыми,
      // потолок 200) — переворачиваем, чтобы показать новые первыми.
      revisions={[...metas]
        .reverse()
        .flatMap((m) =>
          m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : [],
        )}
      selectedId={selected?.id}
      buildHref={(rid) => `/admin/events/${eventId}/edit?revision=${rid}`}
    >
      {selected && (
        <div className="prose">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
