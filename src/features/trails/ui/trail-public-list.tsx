// src/features/trails/ui/trail-public-list.tsx
import Link from "next/link";
import type { Trail } from "../types";

interface Props {
  trails: Trail[];
}

export function TrailPublicList({ trails }: Props) {
  if (trails.length === 0) {
    return <p className="text-sm text-(--color-description)">Маршрутов пока нет.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {trails.map((trail) => (
        <li
          key={trail.id}
          className="rounded border border-(--color-border) p-4 hover:bg-(--color-text-pane)"
        >
          <Link href={`/trails/${trail.id}`} className="block">
            <span className="text-base font-semibold hover:underline">
              {trail.title || "Без названия"}
            </span>
            {trail.description && (
              <span className="mt-1 block text-sm text-(--color-description) line-clamp-2 whitespace-pre-line">
                {trail.description}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
