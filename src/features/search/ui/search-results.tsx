// src/features/search/ui/search-results.tsx
import { EmptyState, RouterLink } from "@/components/ui";

import type { SearchHit, SearchMatch } from "../types";

const TYPE_LABEL: Record<string, string> = {
  lecture: "Лекция",
  glossary: "Термин",
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" });

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dateFormat.format(d);
}

/** Первые до 3 непустых сниппетов хита (бек уже усекает текст). */
function topSnippets(matches: SearchMatch[] | undefined): string[] {
  if (!matches) return [];
  const out: string[] = [];
  for (const m of matches) {
    const s = m.snippet?.trim();
    if (s) out.push(s);
    if (out.length >= 3) break;
  }
  return out;
}

function hitHref(hit: SearchHit): string | null {
  if (hit.type === "lecture" && hit.lecture?.lecture_id) {
    return `/lectures/${hit.lecture.lecture_id}`;
  }
  if (hit.type === "glossary" && hit.glossary_term?.id) {
    return `/glossary/${hit.glossary_term.id}`;
  }
  return null;
}

function hitTitle(hit: SearchHit): string {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- .trim() может дать "", "" → "Без названия" намеренно
  if (hit.type === "lecture") return hit.lecture?.title?.trim() || "Без названия";
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- аналогично: trim → ""
  if (hit.type === "glossary") return hit.glossary_term?.title?.trim() || "Без названия";
  return "Результат";
}

function HitCard({ hit }: { hit: SearchHit }) {
  const href = hitHref(hit);
  // Неизвестный тип или хит без id — нечего открыть, пропускаем (defensive,
  // как .md-handler бека: unknown hit types skipped).
  if (!href) return null;

  const title = hitTitle(hit);
  const label = hit.type ? (TYPE_LABEL[hit.type] ?? hit.type) : "—";
  const date = hit.type === "lecture" ? formatDate(hit.lecture?.date) : null;
  const snippets = topSnippets(hit.matches);

  return (
    <article className="rounded-lg border border-(--color-border) bg-(--color-background) p-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-(--color-text-pane) px-2 py-0.5 text-xs text-(--color-description)">
          {label}
        </span>
        <RouterLink href={href} className="text-lg font-semibold hover:underline">
          {title}
        </RouterLink>
        {date && (
          <time className="text-xs text-(--color-description)">{date}</time>
        )}
      </header>
      {snippets.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {snippets.map((s, i) => (
            <li
              key={i}
              className="rounded px-2 py-1 text-sm hover:bg-(--color-text-pane)"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

interface Props {
  hits: SearchHit[];
  total: number;
}

export function SearchResults({ hits, total }: Props) {
  if (hits.length === 0) {
    return (
      <EmptyState
        title="Ничего не найдено"
        description="Попробуйте изменить запрос или снять фильтр по типу."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-(--color-description)">Найдено: {total}</p>
      <ul className="flex flex-col gap-3">
        {hits.map((hit, i) => (
          <li key={hitHref(hit) ?? i}>
            <HitCard hit={hit} />
          </li>
        ))}
      </ul>
    </div>
  );
}
