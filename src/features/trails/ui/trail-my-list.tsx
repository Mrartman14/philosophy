// src/features/trails/ui/trail-my-list.tsx
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { Trail } from "../types";

interface Props {
  trails: Trail[];
}

export async function TrailMyList({ trails }: Props) {
  const t = await getT("trails");

  if (trails.length === 0) {
    return (
      <p className="text-sm text-(--color-fg-muted)">{t("myListEmpty")}</p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {trails.map((trail) => (
        <li key={trail.id} className="flex items-center justify-between gap-2 py-2">
          <RouterLink href={`/trails/${trail.id}`} className="text-sm hover:underline">
            {trail.title || t("myListUntitled")}
          </RouterLink>
          <span className="text-xs text-(--color-fg-muted)">
            {trail.visibility === "private" ? t("visibilityPrivate") : t("visibilityPublic")}
          </span>
        </li>
      ))}
    </ul>
  );
}
