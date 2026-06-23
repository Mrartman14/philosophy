// src/app/canvases/[id]/page.tsx
import { notFound } from "next/navigation";

import { RouterLink, WideShell } from "@/components/ui";
import {
  canEditCanvas,
  canDeleteCanvas,
  canChangeVisibility,
  canSeeRevisions,
  getCanvasById,
  CanvasDetail,
  CanvasContainers,
  CanvasRevisions,
  CanvasVisibilityButton,
  CanvasDeleteButton,
} from "@/features/canvas";
import { ShareButton, canCreateShareLink, getShareLinksFor } from "@/features/share-links";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string; token?: string }>;
}

export default async function CanvasPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { revision, token } = await searchParams;
  const [me, result] = await Promise.all([getMe(), getCanvasById(id, token)]);
  if (!result) notFound();
  const { canvas } = result;

  const canEdit = canEditCanvas(me, canvas);
  const canDelete = canDeleteCanvas(me, canvas);
  const canPublish = canChangeVisibility(me, canvas);
  const showRevisions = canSeeRevisions(canvas);

  const canShare = canCreateShareLink(me, canvas);
  const shareLinks = canShare && canvas.id ? await getShareLinksFor("canvas", canvas.id) : [];
  const t = await getT("pages");

  return (
    <WideShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{canvas.title ?? t("canvasDefaultTitle")}</h1>
          {canvas.id && (
            <ShareButton
              resourceType="canvas"
              resourceId={canvas.id}
              canCreate={canShare}
              initialLinks={shareLinks}
            />
          )}
        </header>

        <CanvasDetail data={canvas.data} />

        {canvas.id && <CanvasContainers canvasId={canvas.id} token={token} />}

        {canEdit && (
          <section className="flex flex-col gap-4 rounded border border-(--color-border) p-4">
            <h2 className="text-lg font-semibold">{t("canvasEditSection")}</h2>
            <RouterLink
              href={`/canvases/${canvas.id}/edit`}
              className="inline-flex h-10 w-fit items-center rounded bg-(--color-accent) px-4 text-sm font-medium text-(--color-surface)"
            >
              {t("canvasOpenEditor")}
            </RouterLink>
            {canPublish && canvas.id && <CanvasVisibilityButton id={canvas.id} />}
          </section>
        )}

        {showRevisions && canvas.id && (
          <CanvasRevisions canvasId={canvas.id} selectedRevision={revision} token={token} />
        )}

        {canDelete && canvas.id && (
          <div>
            <CanvasDeleteButton id={canvas.id} />
          </div>
        )}
      </div>
    </WideShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [result, t] = await Promise.all([getCanvasById(id), getT("pages")]);
  return { title: result?.canvas.title ?? t("canvasDefaultTitle") };
}
