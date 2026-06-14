// src/features/trails/ui/trail-my-list.tsx
import Link from "next/link";

import type { Trail } from "../types";

interface Props {
  trails: Trail[];
}

const visibilityLabel: Record<string, string> = {
  private: "приватный",
  public: "публичный",
};

export function TrailMyList({ trails }: Props) {
  if (trails.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">У вас пока нет маршрутов.</p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {trails.map((trail) => (
        <li key={trail.id} className="flex items-center justify-between gap-2 py-2">
          <Link href={`/trails/${trail.id}`} className="text-sm hover:underline">
            {trail.title || "Без названия"}
          </Link>
          <span className="text-xs text-(--color-description)">
            {visibilityLabel[trail.visibility ?? "private"] ?? trail.visibility}
          </span>
        </li>
      ))}
    </ul>
  );
}
