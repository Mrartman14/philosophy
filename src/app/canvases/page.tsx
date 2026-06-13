// src/app/canvases/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMe } from "@/utils/me";
import {
  canCreateCanvas,
  getCanvases,
  CanvasMyList,
  CanvasSearch,
  CanvasPagination,
} from "@/features/canvas";
import { Button } from "@/components/ui";

export const metadata = { title: "Канвасы" };

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function CanvasesPage({ searchParams }: Props) {
  const me = await getMe();
  // Список канвасов требует auth (бек: requiredAuth) — гостя на логин.
  if (!me || me.status !== "active") redirect("/login?next=/canvases");

  const { q, offset } = await searchParams;
  const limit = 20;
  const result = await getCanvases({
    ...(q ? { q } : {}),
    offset: offset ? Number(offset) : 0,
    limit,
  });
  const canCreate = canCreateCanvas(me);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Канвасы</h1>
          <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
        </div>
        {canCreate && (
          <Link href="/canvases/new">
            <Button>Создать канвас</Button>
          </Link>
        )}
      </header>

      <CanvasSearch />
      <CanvasMyList canvases={result.items} />
      <CanvasPagination offset={result.offset} limit={result.limit} total={result.total} />
    </main>
  );
}
