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
  getLectureSummary,
  TrailDetail,
  TrailMetaForm,
  TrailItemsEditor,
  TrailVisibilityButton,
  TrailDeleteButton,
} from "@/features/trails";
import type { TrailLectureSummary } from "@/features/trails";
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

  // Резолвим заголовки лекций items в порядке position (items приходят
  // отсортированными по position с бека). React.cache дедуплицирует.
  const items = trail.items ?? [];
  const lectures: TrailLectureSummary[] = await Promise.all(
    items.map((item) => getLectureSummary(item.lecture_id ?? "")),
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{trail.title || "Маршрут"}</h1>
        {trail.id && (
          <ShareButton
            resourceType="trail"
            resourceId={trail.id}
            canCreate={canShare}
            initialLinks={shareLinks}
          />
        )}
      </header>

      <TrailDetail trail={trail} lectures={lectures} />

      {canEdit && (
        <section className="flex flex-col gap-6 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование</h2>
          <TrailMetaForm trail={trail} />
          <TrailItemsEditor trailId={id} initialItems={lectures} />
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
  const trail = await getTrailById(id);
  return { title: trail?.title ?? "Маршрут" };
}
