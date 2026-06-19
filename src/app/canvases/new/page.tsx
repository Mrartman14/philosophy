// src/app/canvases/new/page.tsx
import { redirect } from "next/navigation";

import { canCreateCanvas, CanvasCreateForm } from "@/features/canvas";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("canvasNewTitle") };
}

export default async function NewCanvasPage() {
  const me = await requireActiveUserOrRedirect("/canvases/new");
  if (!canCreateCanvas(me)) redirect("/canvases");

  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">{t("canvasNewHeading")}</h1>
      <CanvasCreateForm />
    </div>
  );
}
