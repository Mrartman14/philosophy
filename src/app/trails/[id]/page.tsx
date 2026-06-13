// src/app/trails/[id]/page.tsx
import { notFound } from "next/navigation";
import { getMe } from "@/utils/me";
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

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TrailPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  const trail = await getTrailById(id);
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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{trail.title || "Маршрут"}</h1>
        {/*
          SHARE-SLOT (фича share-links): кнопку «Поделиться» сюда добавит ветка
          share-links follow-up-коммитом ПОСЛЕ мержа trails. Композиция через
          страницу (как AnnotationsSection в documents) — share-links экспонирует
          компонент из своего index.ts, импорт делается ЗДЕСЬ, не в слайсе trails.
          Кнопка показывается только владельцу public-маршрута (share-токены — на
          public). Не удалять этот комментарий-слот.
        */}
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
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const trail = await getTrailById(id);
  return { title: trail?.title ?? "Маршрут" };
}
