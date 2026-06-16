// src/app/search/page.tsx
import { Suspense } from "react";

import {
  getSearchResults,
  SearchExportLinks,
  SearchInput,
  SearchPagination,
  SearchParamsSchema,
  SearchResults,
  SearchResultsSkeleton,
} from "@/features/search";

const PAGE_LIMIT = 20;

interface Props {
  searchParams: Promise<{
    q?: string;
    type?: string;
    offset?: string;
  }>;
}

export const metadata = { title: "Поиск" };

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  // parse не бросает: каждое поле обёрнуто в .catch(undefined),
  // битые параметры молча отбрасываются.
  const params = SearchParamsSchema.parse(raw);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Поиск</h1>
        <p className="text-sm text-(--color-description)">
          Глобальный поиск по лекциям и терминам глоссария.
        </p>
      </header>

      <SearchInput variant="page" />

      {params.q ? (
        <Suspense
          key={`${params.q}|${params.type ?? ""}|${params.offset ?? 0}`}
          fallback={<SearchResultsSkeleton />}
        >
          <SearchBody
            q={params.q}
            type={params.type}
            offset={params.offset ?? 0}
          />
        </Suspense>
      ) : (
        <p className="text-sm text-(--color-description)">
          Введите запрос, чтобы начать поиск.
        </p>
      )}
    </section>
  );
}

async function SearchBody({
  q,
  type,
  offset,
}: {
  q: string;
  type?: "lecture" | "glossary" | undefined;
  offset: number;
}) {
  let result;
  try {
    result = await getSearchResults({
      q,
      ...(type ? { type } : {}),
      offset,
      limit: PAGE_LIMIT,
    });
  } catch {
    return (
      <p className="text-sm text-(--color-description)">
        Поиск временно недоступен. Попробуйте позже.
      </p>
    );
  }

  return (
    <>
      <SearchResults hits={result.items} total={result.total} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchPagination
          offset={result.offset}
          limit={result.limit}
          total={result.total}
        />
        <SearchExportLinks q={q} type={type} />
      </div>
    </>
  );
}
