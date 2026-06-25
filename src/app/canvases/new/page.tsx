// src/app/canvases/new/page.tsx
import { redirect } from "next/navigation";

import { canCreateCanvas, CanvasEditor } from "@/features/canvas";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("canvasNewTitle") };
}

/**
 * Создание канваса в полноценном визуальном редакторе (mode="create"). title +
 * visibility вводятся в шапке редактора; первый сейв шлёт POST /api/canvases
 * (бек принимает граф при создании) и редиректит в /canvases/{id}/edit.
 */
export default async function NewCanvasPage() {
  const me = await requireActiveUserOrRedirect("/canvases/new");
  if (!canCreateCanvas(me)) redirect("/canvases");

  const t = await getT("pages");

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">{t("canvasNewHeading")}</h1>
      <CanvasEditor mode="create" />
    </div>
  );
}
