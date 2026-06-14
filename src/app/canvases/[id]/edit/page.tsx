// src/app/canvases/[id]/edit/page.tsx
import { notFound, redirect, forbidden } from "next/navigation";

import { canEditCanvas, getCanvasById, CanvasEditor } from "@/features/canvas";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Редактор канваса" };

/**
 * Маршрут визуального редактора. Owner-only (canEditCanvas). Гость → /login;
 * не-владелец → forbidden(). Read-only /canvases/[id] остаётся отдельно.
 */
export default async function CanvasEditPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  if (me?.status !== "active") redirect(`/login?next=/canvases/${id}/edit`);

  const result = await getCanvasById(id);
  if (!result) notFound();
  const { canvas, etag } = result;
  if (!canEditCanvas(me, canvas)) forbidden();

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Редактор канваса {canvas.title}</h1>
      <CanvasEditor canvas={canvas} etag={etag} />
    </div>
  );
}
