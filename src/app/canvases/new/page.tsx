// src/app/canvases/new/page.tsx
import { redirect } from "next/navigation";

import { canCreateCanvas, CanvasCreateForm } from "@/features/canvas";
import { requireActiveUserOrRedirect } from "@/utils/me";

export const metadata = { title: "Новый канвас" };

export default async function NewCanvasPage() {
  const me = await requireActiveUserOrRedirect("/canvases/new");
  if (!canCreateCanvas(me)) redirect("/canvases");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Новый канвас</h1>
      <CanvasCreateForm />
    </div>
  );
}
