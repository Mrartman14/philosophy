// src/features/glossary/ui/glossary-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getT } from "@/i18n";

import { getTermRevision, getTermRevisions } from "../api";

interface Props {
  termId: string;
  /**
   * id выбранной ревизии из searchParams страницы (?revision=).
   * Явный `| undefined` — для exactOptionalPropertyTypes: searchParams-значения
   * имеют тип `string | undefined` (паттерн events/event-revisions.tsx).
   */
  selectedRevisionId?: string | undefined;
}

/**
 * Async server component: фетчит ревизии термина через api.ts слайса и
 * рендерит generic RevisionHistory. Контент выбранной ревизии — AstRender
 * по снапшоту blocks. editor_id бекенда — UUID без username, label не
 * показываем (решение как в слайсе events).
 */
export async function GlossaryRevisions({ termId, selectedRevisionId }: Props) {
  const [t, metas, selected] = await Promise.all([
    getT("glossary"),
    getTermRevisions(termId),
    selectedRevisionId ? getTermRevision(termId, selectedRevisionId) : Promise.resolve(null),
  ]);

  // Бек отдаёт ревизии по created_at ASC (старые первыми) — показываем
  // новые первыми, как принято в RevisionHistory-потребителях.
  const newestFirst = [...metas].reverse();

  return (
    <RevisionHistory
      revisions={newestFirst.flatMap((m) =>
        m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : [],
      )}
      selectedId={selected?.id}
      buildHref={(rid) => `/admin/glossary/${termId}/edit?revision=${rid}`}
      title={t("revisionsTitle")}
    >
      {selected && (
        <div className="content">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
