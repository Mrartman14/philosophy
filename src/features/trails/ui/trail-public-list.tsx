// src/features/trails/ui/trail-public-list.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { Trail } from "../types";

interface Props {
  trails: Trail[];
}

export async function TrailPublicList({ trails }: Props) {
  const t = await getT("trails");

  if (trails.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("publicListEmpty")}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {trails.map((trail) => (
        <li
          key={trail.id}
          className="rounded border border-(--color-border) p-4 hover:bg-(--color-surface-subtle)"
        >
          <RouterLink href={`/trails/${trail.id}`} className="block">
            <span className="text-base font-semibold hover:underline">
              {trail.title || t("publicListUntitled")}
            </span>
            {trail.description && (
              <span className="mt-1 block text-sm text-(--color-fg-muted) line-clamp-2 whitespace-pre-line">
                {trail.description}
              </span>
            )}
          </RouterLink>
        </li>
      ))}
    </ul>
  );
}
