import Link from "next/link";
import type { SearchLectureHit, SearchMatch } from "@/api/types";
import type { SearchResult } from "./api";

const SOURCE_LABELS: Record<string, string> = {
  lecture: "Лекция",
  transcript: "Транскрипт",
  comment: "Комментарии",
  annotation: "Аннотации",
};

function groupBySource(matches: SearchMatch[]): Map<string, SearchMatch[]> {
  const groups = new Map<string, SearchMatch[]>();
  for (const match of matches) {
    const key = match.source || "other";
    const arr = groups.get(key);
    if (arr) {
      arr.push(match);
    } else {
      groups.set(key, [match]);
    }
  }
  return groups;
}

function buildMatchHref(lectureId: string, match: SearchMatch): string {
  if (match.segment_id) {
    return `/lectures/${lectureId}?segment=${match.segment_id}`;
  }
  return `/lectures/${lectureId}`;
}

const LectureHitCard: React.FC<{ hit: SearchLectureHit }> = ({ hit }) => {
  const matches = hit.matches ?? [];
  const groups = groupBySource(matches);
  const dateLabel = hit.date
    ? new Date(hit.date).toLocaleDateString("ru-RU")
    : null;

  return (
    <article className="rounded-lg border border-(--color-border) p-4 bg-(--color-background)">
      <header className="mb-2">
        <Link
          href={`/lectures/${hit.lecture_id}`}
          className="text-lg font-semibold hover:underline"
        >
          {hit.title}
        </Link>
        {dateLabel && (
          <time className="text-xs text-(--color-description) block mt-1">
            {dateLabel}
          </time>
        )}
      </header>

      {groups.size > 0 && (
        <div className="flex flex-col gap-3 mt-3">
          {Array.from(groups.entries()).map(([source, items]) => (
            <section key={source}>
              <h3 className="text-xs uppercase tracking-wide text-(--color-description) mb-1">
                {SOURCE_LABELS[source] ?? source}
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((match, idx) => (
                  <li key={`${source}-${idx}`}>
                    <Link
                      href={buildMatchHref(hit.lecture_id, match)}
                      className="block text-sm text-(--color-text) hover:bg-(--color-text-pane) rounded px-2 py-1"
                    >
                      {match.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </article>
  );
};

interface SearchResultsProps {
  results: SearchResult;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ results }) => {
  const hits = results.data;

  if (hits.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">
        Ничего не найдено.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-(--color-description)">
        Найдено лекций: {results.total}
      </p>
      <ul className="flex flex-col gap-3">
        {hits.map((hit) => (
          <li key={hit.lecture_id}>
            <LectureHitCard hit={hit} />
          </li>
        ))}
      </ul>
    </div>
  );
};
