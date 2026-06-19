// src/features/banners/ui/banner-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";

import { getBannerRevision, getBannerRevisions } from "../api";

interface Props {
  bannerId: string;
  /** id выбранной ревизии из searchParams страницы (?revision=). */
  selectedRevisionId?: string | undefined;
}

/**
 * Server component: фетчит ревизии баннера через api.ts слайса и рендерит
 * generic RevisionHistory (src/components/revision-history — владелец ветка
 * events, контракт переиспользуется as-is). Контент выбранной ревизии —
 * AstRender по снапшоту. editor_id бекенда — UUID без username, в label
 * не показываем.
 */
export async function BannerRevisions({ bannerId, selectedRevisionId }: Props) {
  const metas = await getBannerRevisions(bannerId);
  const selected = selectedRevisionId
    ? await getBannerRevision(bannerId, selectedRevisionId)
    : null;

  return (
    <RevisionHistory
      // Бек отдаёт ревизии в порядке created_at ASC (старые первыми,
      // потолок MaxRevisionsPerEntity = 50) — переворачиваем, чтобы
      // показать новые первыми (контракт RevisionHistoryProps).
      revisions={[...metas]
        .reverse()
        .flatMap((m) =>
          m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : [],
        )}
      selectedId={selected?.id}
      buildHref={(rid) => `/admin/banners/${bannerId}/edit?revision=${rid}`}
    >
      {selected && (
        <div className="content">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
