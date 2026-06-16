// src/app/media/my/page.tsx
import { Pagination } from "@/components/ui";
import {
  MediaGrid,
  MediaUploadForm,
  canCreateMedia,
  getMyMedia,
} from "@/features/media";
import { requireActiveUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export const metadata = { title: "Мои медиа" };

interface Props {
  searchParams: Promise<{ offset?: string; free_floating?: string }>;
}

export default async function MyMediaPage({ searchParams }: Props) {
  const me = await requireActiveUserOrRedirect("/media/my");

  const sp = await searchParams;
  const offset = parseNonNegativeInt(sp.offset, 0);
  const { free_floating } = sp;
  const freeFloating = free_floating === "true";

  const { items, total, limit } = await getMyMedia({ offset, freeFloating });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">Мои медиа</h1>

      <section className="flex flex-col gap-3 rounded border border-(--color-border) p-4">
        <h2 className="text-lg font-semibold">Загрузить</h2>
        <MediaUploadForm canUpload={canCreateMedia(me)} />
      </section>

      <section className="flex flex-col gap-4">
        <MediaGrid items={items} />
        <Pagination basePath="/media/my" offset={offset} limit={limit} total={total} searchParams={sp} />
      </section>
    </div>
  );
}
