// src/app/canvases/[id]/edit/page.tsx
import { notFound, forbidden } from "next/navigation";

import { canEditCanvas, getCanvasById, CanvasEditor } from "@/features/canvas";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("canvasEditorTitle") };
}

/**
 * Маршрут визуального редактора. Owner-only (canEditCanvas). Гость → /login;
 * не-владелец → forbidden(). Read-only /canvases/[id] остаётся отдельно.
 */
export default async function CanvasEditPage({ params }: Props) {
  const { id } = await params;
  const me = await requireActiveUserOrRedirect(`/canvases/${id}/edit`);

  const result = await getCanvasById(id);
  if (!result) notFound();
  const { canvas, etag } = result;
  if (!canEditCanvas(me, canvas)) forbidden();

  const t = await getT("pages");

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">{t("canvasEditorHeading", { title: canvas.title ?? "" })}</h1>
      <CanvasEditor canvas={canvas} etag={etag} />
    </div>
  );
}
