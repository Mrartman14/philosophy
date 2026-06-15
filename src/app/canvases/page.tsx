// src/app/canvases/page.tsx
import { redirect } from "next/navigation";

import { Button, RouterLink } from "@/components/ui";
import {
  canCreateCanvas,
  getCanvases,
  CanvasMyList,
  CanvasSearch,
  CanvasPagination,
} from "@/features/canvas";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export const metadata = { title: "Канвасы" };

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function CanvasesPage({ searchParams }: Props) {
  const me = await getMe();
  // Список канвасов требует auth (бек: requiredAuth) — гостя на логин.
  if (me?.status !== "active") redirect("/login?next=/canvases");

  const { q, offset } = await searchParams;
  const limit = 20;
  const result = await getCanvases({
    ...(q ? { q } : {}),
    offset: parseNonNegativeInt(offset, 0),
    limit,
  });
  const canCreate = canCreateCanvas(me);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Канвасы</h1>
          <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
        </div>
        {canCreate && (
          <RouterLink href="/canvases/new">
            <Button>Создать канвас</Button>
          </RouterLink>
        )}
      </header>

      <CanvasSearch />
      <CanvasMyList canvases={result.items} />
      <CanvasPagination offset={result.offset} limit={result.limit} total={result.total} />
    </div>
  );
}
