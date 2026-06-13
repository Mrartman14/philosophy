// src/app/canvases/new/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import { canCreateCanvas, CanvasCreateForm } from "@/features/canvas";

export const metadata = { title: "Новый канвас" };

export default async function NewCanvasPage() {
  const me = await getMe();
  if (!me || me.status !== "active") redirect("/login?next=/canvases/new");
  if (!canCreateCanvas(me)) redirect("/canvases");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Новый канвас</h1>
      <CanvasCreateForm />
    </div>
  );
}
