// src/features/trails/ui/trail-admin-row.tsx
import Link from "next/link";

import type { Trail } from "../types";

import { TrailDeleteButton } from "./trail-delete-button";

interface Props {
  trail: Trail;
  /** Можно ли admin-удалить (delete_any и не-private). */
  canDelete: boolean;
}

export function TrailAdminRow({ trail, canDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex flex-col">
        <Link href={`/trails/${trail.id}`} className="text-sm hover:underline">
          {trail.title || "Без названия"}
        </Link>
        <span className="text-xs text-(--color-description)">
          {trail.visibility} · автор {trail.owner_id}
        </span>
      </div>
      {canDelete && trail.id && (
        <TrailDeleteButton id={trail.id} admin redirectTo="/admin/trails" />
      )}
    </li>
  );
}
