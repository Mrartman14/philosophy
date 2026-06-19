// src/app/trails/[id]/page.tsx
import { notFound } from "next/navigation";

import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
import {
  canEditTrail,
  canDeleteTrail,
  getTrailById,
  getDocumentSummary,
  TrailDetail,
  TrailMetaForm,
  TrailItemsEditor,
  TrailVisibilityButton,
  TrailDeleteButton,
} from "@/features/trails";
import type { TrailDocumentSummary } from "@/features/trails";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function TrailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const [me, trail] = await Promise.all([getMe(), getTrailById(id, token)]);
  if (!trail) notFound();

  // Резолвим метаданные документов items в порядке position (items приходят
  // отсортированными по position с бека). React.cache дедуплицирует.
  // Элементы без document_id отбрасываем до резолва — пустая строка даёт
  // битую ссылку /documents/, а getDocumentSummary вернёт заглушку для 404.
  const documents: TrailDocumentSummary[] = await Promise.all(
    (trail.items ?? [])
      .flatMap((item) => (item.document_id ? [item.document_id] : []))
      .map((docId) => getDocumentSummary(docId)),
  );

  const canEdit = canEditTrail(me, trail);
  const canDelete = canDeleteTrail(me, trail);
  const isPrivateOwned = canEdit && trail.visibility === "private";

  // SHARE-SLOT (фича share-links): кнопка «Поделиться». Композиция через
  // страницу (как AnnotationsSection в documents) — share-links экспонирует
  // ShareButton из своего index.ts, импорт делается ЗДЕСЬ, не в слайсе trails.
  // Бек выдаёт share-токены только для PRIVATE-ресурсов (RESOURCE_NOT_PRIVATE
  // 422 на public) — canCreateShareLink проверяет owner + visibility=="private".
  const canShare = canCreateShareLink(me, trail);
  const shareLinks =
    canShare && trail.id ? await getShareLinksFor("trail", trail.id) : [];
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{trail.title || t("trailDefaultTitle")}</h1>
        {trail.id && (
          <ShareButton
            resourceType="trail"
            resourceId={trail.id}
            canCreate={canShare}
            initialLinks={shareLinks}
          />
        )}
      </header>

      <TrailDetail trail={trail} documents={documents} />

      {canEdit && (
        <section className="flex flex-col gap-6 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">{t("trailEditSection")}</h2>
          <TrailMetaForm trail={trail} />
          <TrailItemsEditor trailId={id} trailVersion={trail.version} initialItems={documents} />
          {isPrivateOwned && trail.id && <TrailVisibilityButton id={trail.id} />}
        </section>
      )}

      {canDelete && trail.id && (
        <div>
          <TrailDeleteButton id={trail.id} />
        </div>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [trail, t] = await Promise.all([getTrailById(id), getT("pages")]);
  return { title: trail?.title ?? t("trailDefaultTitle") };
}
