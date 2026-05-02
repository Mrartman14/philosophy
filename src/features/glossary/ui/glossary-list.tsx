// src/features/glossary/ui/glossary-list.tsx
import Link from "next/link";
import type { Term } from "../types";

interface Props {
  items: Term[];
  total: number;
}

export function GlossaryList({ items, total }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-description)">
        Термины не найдены.
      </div>
    );
  }
  const sorted = [...items].sort((a, b) =>
    (a.title ?? "").localeCompare(b.title ?? "", "ru")
  );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-(--color-description)">Всего: {total}</p>
      <ul className="flex flex-col divide-y divide-(--color-border)">
        {sorted.map((term, i) => (
          <li key={term.id ?? `idx-${i}`} className="py-2">
            {term.id ? (
              <Link
                href={`/glossary/${term.id}`}
                className="text-base hover:underline"
              >
                {term.title}
              </Link>
            ) : (
              <span className="text-base">{term.title}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
