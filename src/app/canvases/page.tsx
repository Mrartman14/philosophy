// src/app/canvases/page.tsx
import { Button, Pagination, RouterLink } from "@/components/ui";
import {
  canCreateCanvas,
  getCanvases,
  CanvasMyList,
  CanvasSearch,
} from "@/features/canvas";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("canvasesTitle") };
}

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function CanvasesPage({ searchParams }: Props) {
  // Список канвасов требует auth (бек: requiredAuth) — гостя на логин.
  const me = await requireActiveUserOrRedirect("/canvases");

  const sp = await searchParams;
  const { q, offset } = sp;
  const limit = 20;
  const result = await getCanvases({
    ...(q ? { q } : {}),
    offset: parseNonNegativeInt(offset, 0),
    limit,
  });
  const canCreate = canCreateCanvas(me);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("canvasesHeading")}</h1>
          <p className="text-sm text-(--color-fg-muted)">{t("canvasesTotal", { total: result.total })}</p>
        </div>
        {canCreate && (
          <RouterLink href="/canvases/new">
            <Button>{t("canvasesCreate")}</Button>
          </RouterLink>
        )}
      </header>

      <CanvasSearch />
      <CanvasMyList canvases={result.items} />
      <Pagination basePath="/canvases" offset={result.offset} limit={result.limit} total={result.total} searchParams={sp} />
    </div>
  );
}
