import type { Metadata } from "next";
import { search, type SearchResult } from "@/features/search/api";
import { SearchResults } from "@/features/search/search-results";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const metadata: Metadata = {
  title: "Поиск",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  if (!q) {
    return (
      <div className="w-full p-4">
        <h1 className="text-xl font-bold mb-2">Поиск</h1>
        <p className="text-sm text-(--color-description)">
          Введите поисковый запрос.
        </p>
      </div>
    );
  }

  let results: SearchResult | null = null;
  let failed = false;
  try {
    results = await search(q);
  } catch {
    failed = true;
  }

  return (
    <div className="w-full p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold">Результаты: «{q}»</h1>
      {failed || !results ? (
        <p className="text-sm text-(--color-description)">
          Поиск временно недоступен. Попробуйте позже.
        </p>
      ) : (
        <SearchResults results={results} />
      )}
    </div>
  );
}
