// src/app/trails/page.tsx
import { Pagination } from "@/components/ui";
import { getTrails, TrailPublicList } from "@/features/trails";
import { parseNonNegativeInt } from "@/utils/paging";

export const metadata = { title: "Маршруты" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function TrailsPage({ searchParams }: Props) {
  const { offset } = await searchParams;
  const result = await getTrails({ offset: parseNonNegativeInt(offset, 0), limit: 20 });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Маршруты</h1>
        <p className="text-sm text-(--color-description)">
          Курируемые подборки лекций. Всего: {result.total}
        </p>
      </header>

      <TrailPublicList trails={result.items} />

      <Pagination
        basePath="/trails"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
      />
    </div>
  );
}
